from ariadne import gql, QueryType, MutationType, ScalarType, make_executable_schema
from ariadne.wsgi import GraphQL
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.typing import LambdaContext
from datetime import datetime
from mangum import Mangum
from pydantic import ValidationError

from genai_core.types import CommonError

from converted_solution.lambda.send_query_lambda_resolver.index import handler as send_query_handler

type_defs = gql(open("schema.graphql").read())
query = QueryType()
mutation = MutationType()

# Create the Ariadne ScalarType for DateTime
datetime_scalar = ScalarType("DateTime")

@datetime_scalar.serializer
def serialize_datetime(value):
    """Serializes a datetime object to an ISO 8601 string."""
    if isinstance(value, datetime):
        return value.isoformat()
    return None

@datetime_scalar.value_parser
def parse_datetime_value(value):
    """Parses an ISO 8601 string to a datetime object."""
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            raise ValueError("Invalid DateTime format. Expected ISO 8601 string.")
    return None

# Register all resolvers and scalars
@mutation.field("publishResponse")
def resolve_publish_response(_, info, data, sessionId, userId):
    return {
        "data": data,
        "sessionId": sessionId,
        "userId": userId,
    }

@mutation.field("sendQuery")
def resolve_send_query(_, info, data):
    event = {
        "arguments": {
            "data": data
        },
        "identity": info.context.get("identity", {}),
        "info": {
            "fieldName": "sendQuery"
        }
    }
    context = {}
    return send_query_handler(event, context)

# Ariadne Lambda handler pattern

schema = make_executable_schema(type_defs, [query, mutation, date_time_scalar])
app = GraphQL(schema, debug=True)
handler = Mangum(app)

tracer = Tracer()
logger = Logger(serialize_stacktrace=True)

@logger.inject_lambda_context(
    log_event=False, correlation_id_path=correlation_paths.APPSYNC_RESOLVER
)
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    try:
        logger.info(
            "Incoming request",
            event=event
        )
        return handler(event, context)
    except ValidationError as e:
        errors = e.errors(include_url=False, include_context=False, include_input=False)
        logger.warning("Validation error", errors=errors)
        raise ValueError(f"Invalid request. Details: {errors}")
    except CommonError as e:
        logger.warning(str(e))
        raise e
    except Exception as e:
        # Do not return an unknown exception to the end user.
        # Instead return a generic message
        # This is to prevent leaking internal information.
        logger.exception(e)
        raise RuntimeError("Something went wrong")

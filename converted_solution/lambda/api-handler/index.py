from ariadne import gql, QueryType, MutationType, ScalarType, make_executable_schema
from ariadne.wsgi import GraphQL
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.typing import LambdaContext
from mangum import Mangum
from pydantic import ValidationError

from genai_core.types import CommonError
from graphql_scalars import DateTime as DateTimeScalar

type_defs = gql(open("schema.graphql").read())
query = QueryType()
mutation = MutationType()

# Create the Ariadne ScalarType for DateTime
date_time_scalar = ScalarType("DateTime")

@date_time_scalar.serializer
def serialize_datetime(value):
    return DateTimeScalar.serialize(value)

@date_time_scalar.value_parser
def parse_datetime_value(value):
    return DateTimeScalar.parse_value(value)

# Register all resolvers and scalars
schema = make_executable_schema(type_defs, [query, mutation, date_time_scalar])

tracer = Tracer()
logger = Logger(serialize_stacktrace=True)

# Pure Ariadne Lambda handler pattern
app = GraphQL(schema, debug=True)
handler = Mangum(app)

# app.include_router(health_router)
# app.include_router(rag_router)
# app.include_router(embeddings_router)
# app.include_router(cross_encoders_router)
# app.include_router(models_router)
# app.include_router(workspaces_router)
# app.include_router(sessions_router)
# app.include_router(semantic_search_router)
# app.include_router(documents_router)
# app.include_router(kendra_router)
# app.include_router(user_feedback_router)
# app.include_router(bedrock_kb_router)
# app.include_router(roles_router)
# app.include_router(applicatiion_router)


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

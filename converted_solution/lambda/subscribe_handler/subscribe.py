import json
import os
import re
import boto3

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ["CONNECTIONS_TABLE"]

SESSION_ID_REGEX = r"^[a-z0-9-]{10,50}$"

def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    authorizer = event['requestContext'].get('authorizer', {})
    user_id = authorizer.get('principalId', 'anonymous')

    body = json.loads(event.get('body', '{}'))
    session_id = body.get('sessionId', '')

    # Validate sessionId
    if not re.match(SESSION_ID_REGEX, session_id):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Invalid sessionId"})
        }

    # Store the connection with sessionId and userId
    table = dynamodb.Table(TABLE_NAME)
    table.put_item(Item={
        "connectionId": connection_id,
        "sessionId": session_id,
        "userId": user_id
    })

    return {
        "statusCode": 200,
        "body": json.dumps({"message": f"Subscribed to session {session_id}", "connectionId": connection_id})
    }
import json
import os
import boto3

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ["CONNECTIONS_TABLE"]

def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    # Remove the connection from DynamoDB
    table = dynamodb.Table(TABLE_NAME)
    table.delete_item(Key={"connectionId": connection_id})
    return {
        "statusCode": 200,
        "body": json.dumps({"message": "Disconnected", "connectionId": connection_id})
    }
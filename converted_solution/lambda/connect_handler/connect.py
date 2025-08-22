import json
import os
import boto3

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ["CONNECTIONS_TABLE"]

def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    # Store the connection in DynamoDB (no session yet)
    table = dynamodb.Table(TABLE_NAME)
    table.put_item(Item={"connectionId": connection_id})
    return {
        "statusCode": 200,
        "body": json.dumps({"message": "Connected", "connectionId": connection_id})
    }
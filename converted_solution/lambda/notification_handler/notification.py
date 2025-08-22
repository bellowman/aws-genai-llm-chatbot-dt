import json
import os
import boto3

dynamodb = boto3.resource("dynamodb")
apigw = boto3.client("apigatewaymanagementapi", endpoint_url=os.environ["WS_ENDPOINT"])
TABLE_NAME = os.environ["CONNECTIONS_TABLE"]

def lambda_handler(event, context):
    # SNS event
    for record in event['Records']:
        msg = json.loads(record['Sns']['Message'])
        session_id = msg['sessionId']
        message = msg['message']

        # Query DynamoDB for all connections subscribed to this session
        table = dynamodb.Table(TABLE_NAME)
        response = table.scan(
            FilterExpression="sessionId = :sid",
            ExpressionAttributeValues={":sid": session_id}
        )
        for item in response.get('Items', []):
            connection_id = item['connectionId']
            try:
                apigw.post_to_connection(
                    ConnectionId=connection_id,
                    Data=json.dumps({"sessionId": session_id, "message": message})
                )
            except Exception as e:
                print(f"Failed to send to {connection_id}: {e}")
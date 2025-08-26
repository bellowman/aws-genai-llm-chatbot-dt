import os
import json
import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb")
connections_table = dynamodb.Table(os.environ["CONNECTIONS_TABLE"])
apigw = boto3.client("apigatewaymanagementapi", endpoint_url=os.environ["WS_ENDPOINT"]) # API Gateway WebSocket endpoint (e.g. "https://abc123.execute-api.us-east-1.amazonaws.com/dev")

def lambda_handler(event, context):
    # SQS event format: event['Records'] is a list of messages.
    for record in event["Records"]:
        # SQS payload is SNS, which has a 'Message' field containing the actual message
        sns_obj = json.loads(record["body"])
        message = json.loads(sns_obj["Message"]) if "Message" in sns_obj else sns_obj

        session_id = message.get("sessionId")
        user_id = message.get("userId")  # Optional, if you want to filter by user_id

        if not session_id:
            print("No sessionId in message, skipping.")
            continue

        # Query DynamoDB for connections in this session (and user, if needed)
        filter_expr = "sessionId = :sid"
        expr_vals = {":sid": session_id}
        if user_id:
            filter_expr += " AND userId = :uid"
            expr_vals[":uid"] = user_id

        # Scan for all connections matching session (and user, if required)
        response = connections_table.scan(
            FilterExpression=filter_expr,
            ExpressionAttributeValues=expr_vals,
        )

        payload = {
            "sessionId": session_id,
            "message": message.get("data") or message.get("message"),
            "userId": user_id,
        }

        for item in response.get("Items", []):
            connection_id = item["connectionId"]
            try:
                apigw.post_to_connection(
                    ConnectionId=connection_id,
                    Data=json.dumps(payload).encode("utf-8"),
                )
            except ClientError as e:
                print(f"Error sending to {connection_id}: {e}")
                if e.response["Error"]["Code"] == "GoneException":
                    # Remove stale connection
                    connections_table.delete_item(Key={"connectionId": connection_id})

    return {"statusCode": 200, "body": "Processed outgoing messages"}
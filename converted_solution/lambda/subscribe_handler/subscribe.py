import json
import os
import boto3

sns = boto3.client("sns")
SNS_TOPIC_ARN = os.environ["SNS_TOPIC_ARN"]

def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    body = json.loads(event.get('body', '{}'))
    session_id = body.get('sessionId', '')
    message = body.get('message', '')

    # Publish the message to SNS for the session
    sns.publish(
        TopicArn=SNS_TOPIC_ARN,
        Message=json.dumps({
            "sessionId": session_id,
            "message": message
        })
    )

    return {
        "statusCode": 200,
        "body": json.dumps({"message": f"Message sent to session {session_id}", "connectionId": connection_id})
    }
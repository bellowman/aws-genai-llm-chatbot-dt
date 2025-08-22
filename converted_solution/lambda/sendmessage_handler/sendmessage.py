import json

def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    body = json.loads(event.get('body', '{}'))
    message = body.get('message', '')

    # Here you could process the message, echo it, or route it to other connections
    # Example: send_message_to_subscribers(message)

    return {
        "statusCode": 200,
        "body": json.dumps({"message": f"Message received: {message}", "connectionId": connection_id})
    }
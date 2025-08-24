# Previous Chat History
## 1. Update Outgoing Message Logic
- In your current `outgoing-message-appsync/graphql.ts` and any relevant Python or TypeScript files, check if they are sending mutations or messages to AppSync.
- Replace all AppSync mutation calls with logic that publishes messages to your SNS topic.
- Use the AWS SDK (boto3 for Python or @aws-sdk/client-sns for Node.js) to publish events.
Example (Python):
```
import boto3
import os

sns = boto3.client("sns")
SNS_TOPIC_ARN = os.environ["SNS_TOPIC_ARN"]

def publish_event(payload):
    sns.publish(
        TopicArn=SNS_TOPIC_ARN,
        Message=json.dumps(payload)
    )
```

## 2. `schema.graphql`
Replace `AWSDateTime`

## 3. `chatbot-api/index.ts`
### What's Happening
- Creates AWS Resources:
    - DynamoDB tables for sessions, applications, etc.
    - S3 buckets for files and user feedback.
    - SNS topics and SQS queues for messaging.
    - IAM roles and policies for permissions.
    - WAF (Web Application Firewall) for security.
    - AppSync GraphQL API (with schema, auth config, logging, etc.).
    - Lambda functions for resolvers and real-time messaging.
- Configures AppSync:
    - Loads the GraphQL schema.
    - Sets up authorization (Cognito User Pool, IAM).
    - Connects Lambda resolvers to AppSync fields.
    - Outputs the API URL and ID.
- Adds WAF rules:
    - Rate limits and allows internal calls.
- Links everything together:
    - Passes resource references (tables, buckets, topics) to Lambda functions and other constructs.

### How Does This Map to New Stack
#### Covered by Terraform:
- DynamoDB, S3, SNS, SQS, IAM, WAF:
You can (and should) provision all these resources in Terraform, just as CDK does in TypeScript.
- API Gateway (HTTP & WebSocket):
Your Terraform code provisions HTTP API for GraphQL (Apollo/Ariadne) and WebSocket API for real-time messaging, replacing AppSync.
- Lambda Functions:
Terraform provisions all Lambda functions (GraphQL handler, connect/disconnect/sendmessage/subscribe handlers, notification handler, etc.).
- Resource wiring:
Environment variables and permissions are set in Terraform, just as CDK does.
#### Covered by apollo.py:
- GraphQL API Implementation:
apollo.py (with Ariadne) implements your GraphQL schema and resolvers, replacing AppSync’s built-in resolver system.
- Schema loading:
Loads the same schema.graphql file as AppSync did.
- Business logic:
All query/mutation/subscription logic is now in your Python code, not in AppSync mapping templates or Lambda resolvers.

#### What’s Not Covered / Needs Attention
- AppSync-specific features:
Your new stack does not use AppSync. All AppSync-specific configuration, mapping templates, and schema directives are replaced by your own code and API Gateway.
- Authorization:
AppSync’s built-in Cognito/IAM auth must be replaced by custom logic in your Python resolvers or middleware.
- WAF:
If you want WAF protection, you must add it to your API Gateway endpoints in Terraform (not shown in your current code).
- Outputs:
If you want to output API URLs/IDs, use Terraform output blocks.

## 4. `appsync-ws.ts`
### What's Happening
- Creates Lambda functions for handling GraphQL queries and outgoing messages.
- Configures AppSync resolvers for:
    - Mutation.sendQuery (handled by Lambda)
    - Mutation.publishResponse (handled by JS resolver)
- Subscription.receiveMessages (handled by JS resolver)
- Sets up data sources (Lambda and None) for AppSync.
- Grants permissions for SNS, DynamoDB, and KMS.
- Wires up event sources (SQS) and environment variables.

### How Does This Map to New Stack
#### What’s Covered:
- Lambda Functions:
You now define and deploy Lambda functions (for GraphQL, connect/disconnect, sendMessage, subscribe, notification, etc.) using Terraform.
- API Gateway (HTTP & WebSocket):
You use API Gateway HTTP API for GraphQL (Ariadne/Apollo) and WebSocket API for real-time messaging, replacing AppSync’s built-in subscription system.
- SNS, DynamoDB, SQS:
These resources are provisioned and used for pub/sub and state tracking, just as in the CDK stack.
- Resolvers:
Your Python code (Ariadne/Apollo) implements all GraphQL queries, mutations, and subscriptions, replacing AppSync’s resolver mapping.

#### What’s Not Directly Covered:
- AppSync-specific configuration:
All AppSync-specific constructs, resolvers, and mapping templates are not used in your new stack.
- Automatic subscription wiring:
In AppSync, the receiveMessages subscription is automatically managed. In your new stack, you must manually implement the subscription protocol using WebSocket routes, DynamoDB, and SNS/Lambda for message delivery.

## 5. For `rest-api.ts`
### What's Happening
- Creates a Lambda function (appSyncLambdaResolver) that acts as the main AppSync resolver, with all required environment variables, layers, permissions, and VPC/networking.
- Grants permissions to this Lambda for DynamoDB, S3, SQS, SNS, Kendra, SageMaker, Bedrock, Cognito, and other AWS resources.
- Loads the GraphQL schema from schema.graphql.
- Creates a Lambda data source in AppSync and attaches it to the API.
- Automatically adds resolvers for all fields in the Query and Mutation types, except for those handled by the real-time API (like sendQuery and publishResponse).
- Handles resource wiring (passing ARNs, table names, etc. as environment variables).

### How Does This Map to New Stack
#### Covered by Terraform:
- Lambda Functions:
You define all Lambda functions (GraphQL handler, connect/disconnect/sendmessage/subscribe, notification, etc.) in Terraform.
- Permissions:
You grant all necessary IAM permissions in Terraform.
- Environment Variables:
You set environment variables for each Lambda in Terraform.
- Resource Wiring:
You wire up DynamoDB, S3, SNS, etc. to your Lambdas via Terraform.

#### Covered by Apollo/Ariadne (apollo.py):
- GraphQL API Implementation:
Your Python code (Ariadne or Apollo) loads the same schema and implements all resolvers for queries, mutations, and subscriptions.
- Schema Loading:
Your Python code loads schema.graphql at runtime (make sure it’s included in your Lambda package).
- Business Logic:
All query/mutation/subscription logic is now in Python, not in AppSync mapping templates or Lambda resolvers.

#### What’s Not Directly Covered:
- AppSync-specific features:
All AppSync-specific configuration, data sources, and resolver wiring are not used in your new stack.
- Automatic resolver creation:
You must manually implement and expose each resolver in your Python code, rather than having AppSync auto-wire them.

## 6. For `websocket-api.ts`
### What's Happening
- Creates an SNS Topic (messagesTopic) to act as a message bus for real-time events.
- Enables X-Ray tracing for SNS if advanced monitoring is enabled.
- Creates SQS Queues (main and dead-letter) for outgoing messages.
- Sets up permissions so EventBridge and SQS can send messages to the queue.
- Creates a RealtimeResolvers construct (which wires up AppSync subscriptions and Lambda resolvers for real-time messaging).
- Adds an SNS subscription so that only messages with a certain direction (e.g., "Out") are routed to the outgoing messages queue.
- Exposes the SNS topic, SQS queue, and resolvers as properties for use elsewhere in the stack.
- Adds CDK Nag suppressions for compliance checks.

### How Does This Map to New Stack
#### Covered by Terraform:
- SNS Topic:
You can (and should) create an SNS topic in Terraform for real-time message - broadcasting.
- SQS Queues:
You can create SQS queues (and DLQs) in Terraform for message delivery and retries.
- Permissions:
You can set up all necessary IAM policies and resource permissions in Terraform.
- SNS → SQS Subscription:
You can add SNS subscriptions to SQS with filter policies in Terraform.

#### Covered by Lambda + API Gateway:
- Real-time messaging:
Instead of AppSync, you now use API Gateway WebSocket API + Lambda for real-time message delivery.
- Resolvers:
The RealtimeResolvers construct is replaced by your Lambda functions and WebSocket route handlers, which manage subscriptions and message delivery.

#### What’s Not Directly Covered:
- AppSync-specific constructs:
All AppSync-specific resolver wiring is replaced by your own Lambda/WebSocket implementation.
- CDK Nag suppressions:
Not needed in Terraform, but you should ensure your resources are secure and compliant.

## 7.  `subscribe-resolver.js`, `publish-response-resolver.js`, `lambda-resolver.js`
### 1. subscribe-resolver.js
#### Purpose:
- Handles the Subscription.receiveMessages resolver in AppSync.
- Validates the sessionId argument.
- Sets a subscription filter so only messages matching both userId and sessionId are delivered to the subscriber.

#### Key logic:
- Validates sessionId format.
- Filters messages by userId and sessionId for the subscription.

#### How to cover in your new stack:
- In your Python WebSocket/Lambda subscription handler, when a client subscribes, validate the sessionId and store the mapping {connectionId, userId, sessionId} in DynamoDB.
- When publishing, look up all connections for the given sessionId and userId and deliver the message.

### 2. publish-response-resolver.js
#### Purpose:
- Handles the Mutation.publishResponse resolver in AppSync.
- Packages the mutation arguments (data, sessionId, userId) into a payload for the subscription system.

#### Key logic:
- Prepares the payload for subscribers.

#### How to cover in your new stack:
- In your Python mutation resolver for publishResponse, publish an event (e.g., to SNS) with the payload {data, sessionId, userId}.
- Your notification Lambda (triggered by SNS) will use this payload to deliver messages to the correct subscribers.

### 3. lambda-resolver.js
#### Purpose:
- Generic AppSync Lambda resolver.
- Forwards the GraphQL field name, arguments, identity, and source to a Lambda function.
- Handles errors and returns the result.

#### Key logic:
- Passes all relevant context to Lambda.
- Handles errors.

#### How to cover in your new stack:
- In your Python GraphQL server (Ariadne/Apollo), each resolver function receives the field name, arguments, and context (including identity).
- You handle errors and return results directly in Python.

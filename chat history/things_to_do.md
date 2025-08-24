# Things to Do

## `schema.graphql`
- add new scalar type
- `api-handler/index.py`
    - refactor

##  `appsync-ws.ts`
- Resolvers
    - All logic in JS/Python resolvers in AppSync (e.g. sendQuery, publishResponse, receiveMessages) must be re-implemented as Python code in your Lambda handlers/Apollo resolvers/WebSocket handlers.
- SQS-triggered Outbound
    - Outbound message Lambda (triggered by SQS) must now know how to send to the correct WebSocket connection (via API Gateway Management API).
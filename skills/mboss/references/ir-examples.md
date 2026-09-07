# IR examples

Worked Workflow IR documents, for shaping a `workflow_apply_spec` spec by
example.

## `groom_booking`

An event trigger looks for an open slot, falls back to a Twilio chat
exchange with a bounded reschedule loop, records the booking in a
`transaction`, then emails a confirmation. Copied verbatim from
`mboss-core`'s own fixture (`fixtures/ir/groom_booking.workflow.json`) —
already validated there, with a matching compiled-code golden to compare
against.

```json
{
  "$schema": "https://mboss.dev/schemas/workflow-v1.json",
  "version": 1,
  "revision": 12,
  "name": "groom_booking",
  "title": "Groom booking",
  "nodes": [
    { "id": "booking_requested", "kind": "trigger", "title": "Booking request",
      "config": { "mode": "event", "topic": "booking.requested",
        "idempotencyKeyPath": "requestId", "requesterEmailPath": "customer.email" },
      "out": "WebhookEvent" },
    { "id": "parse_request", "kind": "step", "title": "Parse request",
      "handler": { "export": "parseRequest" }, "in": "WebhookEvent", "out": "BookingReq",
      "config": {} },
    { "id": "find_slot", "kind": "step", "title": "Find open slot",
      "handler": { "export": "findSlot" }, "in": "BookingReq", "out": "SlotGrid",
      "retry": { "maxAttempts": 3, "intervalSeconds": 1, "backoffRate": 2 }, "config": {} },
    { "id": "slot_open", "kind": "branch", "title": "Open at requested time?", "in": "SlotGrid",
      "config": { "cases": [ { "port": "yes",
        "when": { "path": "requestedSlotFree", "op": "eq", "value": true } } ],
        "elsePort": "no" } },
    { "id": "twilio_chat", "kind": "step", "title": "Twilio chat — you decide",
      "handler": { "export": "twilioChat" }, "in": "SlotGrid", "out": "ChatPrompt", "config": {} },
    { "id": "await_reply", "kind": "durableWait", "title": "Wait for SMS reply",
      "config": { "source": { "kind": "event", "topic": "twilio.reply",
          "correlationPath": "from", "correlateWith": "to" },
        "timeoutDays": 2, "onTimeout": "abort" }, "out": "ChatReply" },
    { "id": "reply_decision", "kind": "branch", "title": "Reply?", "in": "ChatReply",
      "config": { "cases": [
        { "port": "new_time", "when": { "path": "intent", "op": "eq", "value": "reschedule" },
          "maxIterations": 10, "onExhausted": "abort" },
        { "port": "book_it",  "when": { "path": "intent", "op": "eq", "value": "book" } } ],
        "elsePort": "stop" } },
    { "id": "book_appointment", "kind": "step", "title": "Book appointment",
      "handler": { "export": "bookAppointment" }, "in": "SlotGrid", "out": "Booking",
      "retry": { "maxAttempts": 2, "intervalSeconds": 2, "backoffRate": 2 }, "config": {} },
    { "id": "record_booking", "kind": "transaction", "title": "Record booking",
      "handler": { "export": "recordBooking" }, "in": "Booking", "out": "Booking", "config": {} },
    { "id": "send_confirmation", "kind": "emailSend", "title": "Send confirmation",
      "in": "Booking",
      "config": { "to": "requestingUser", "subject": "Your booking is confirmed",
        "bodyMarkdown": "…", "attach": { "type": "none" } } }
  ],
  "edges": [
    { "id": "e1", "from": { "node": "booking_requested", "port": "out" }, "to": { "node": "parse_request" }, "type": "WebhookEvent" },
    { "id": "e2", "from": { "node": "parse_request", "port": "out" }, "to": { "node": "find_slot" }, "type": "BookingReq" },
    { "id": "e3", "from": { "node": "find_slot", "port": "out" }, "to": { "node": "slot_open" }, "type": "SlotGrid" },
    { "id": "e4", "from": { "node": "slot_open", "port": "yes" }, "to": { "node": "book_appointment" }, "type": "SlotGrid" },
    { "id": "e5", "from": { "node": "slot_open", "port": "no" }, "to": { "node": "twilio_chat" }, "type": "SlotGrid" },
    { "id": "e6", "from": { "node": "twilio_chat", "port": "out" }, "to": { "node": "await_reply" }, "type": "ChatPrompt" },
    { "id": "e7", "from": { "node": "await_reply", "port": "out" }, "to": { "node": "reply_decision" }, "type": "ChatReply" },
    { "id": "e8", "from": { "node": "reply_decision", "port": "new_time" }, "to": { "node": "find_slot" }, "type": "BookingReq", "back": true },
    { "id": "e9", "from": { "node": "reply_decision", "port": "book_it" }, "to": { "node": "book_appointment" }, "type": "SlotGrid" },
    { "id": "e10", "from": { "node": "book_appointment", "port": "out" }, "to": { "node": "record_booking" }, "type": "Booking" },
    { "id": "e11", "from": { "node": "record_booking", "port": "out" }, "to": { "node": "send_confirmation" }, "type": "Booking" }
  ]
}
```

## `slot_retry_abort`

The same booking flow, cut down to the shape a decision branch makes.
`look_again` runs `tryAgain` as a step of its own and tests the boolean
it answered; the `again` case carries the run back to `find_slot` for up
to ten rounds, and `onExhausted: "abort"` ends the run rather than book
a slot nobody accepted. Note that nothing wires the `else` port: the two
cases cover both answers. Copied verbatim from `mboss-core`'s own
fixture (`fixtures/ir/slot_retry_abort.workflow.json`), which has a
compiled-code golden of its own.

```json
{
  "$schema": "https://mboss.dev/schemas/workflow-v1.json",
  "version": 1,
  "revision": 1,
  "name": "slot_retry_abort",
  "title": "Slot retry, aborting",
  "nodes": [
    { "id": "booking_requested", "kind": "trigger", "title": "Booking request",
      "config": { "mode": "event", "topic": "booking.requested",
        "idempotencyKeyPath": "requestId" },
      "out": "WebhookEvent" },
    { "id": "parse_request", "kind": "step", "title": "Parse request",
      "handler": { "export": "parseRequest" }, "in": "WebhookEvent", "out": "BookingReq",
      "config": {} },
    { "id": "find_slot", "kind": "step", "title": "Find open slot",
      "handler": { "export": "findSlot" }, "in": "BookingReq", "out": "SlotGrid",
      "config": {} },
    { "id": "look_again", "kind": "branch", "title": "Look again?", "in": "SlotGrid",
      "handler": { "export": "tryAgain" },
      "config": { "cases": [
        { "port": "again", "when": { "path": "", "op": "eq", "value": true },
          "maxIterations": 10, "onExhausted": "abort" },
        { "port": "take_it", "when": { "path": "", "op": "eq", "value": false } } ],
        "elsePort": "else" } },
    { "id": "book_appointment", "kind": "step", "title": "Book appointment",
      "handler": { "export": "bookAppointment" }, "in": "SlotGrid", "out": "Booking",
      "config": {} }
  ],
  "edges": [
    { "id": "e1", "from": { "node": "booking_requested", "port": "out" }, "to": { "node": "parse_request" }, "type": "WebhookEvent" },
    { "id": "e2", "from": { "node": "parse_request", "port": "out" }, "to": { "node": "find_slot" }, "type": "BookingReq" },
    { "id": "e3", "from": { "node": "find_slot", "port": "out" }, "to": { "node": "look_again" }, "type": "SlotGrid" },
    { "id": "e4", "from": { "node": "look_again", "port": "again" }, "to": { "node": "find_slot" }, "type": "BookingReq", "back": true },
    { "id": "e5", "from": { "node": "look_again", "port": "take_it" }, "to": { "node": "book_appointment" }, "type": "SlotGrid" }
  ]
}
```

## `refund_approval`

An event trigger loads the purchase, asks code of yours what the refund
policy says, and either pays it out or waits on a person: the
`auto_approve` case goes straight to the `apiCall`, the `review` case to
an `approval` whose `approved` port reaches that same block and whose
`rejected` port ends in a denial email. The order write afterwards is a
`transaction`, and the two emails carry no attachment. The two arms
share everything below the approval, which is allowed here because
neither of them binds a value of its own before they meet — the rule
references/conventions.md states. Copied verbatim from `mboss-core`'s
pattern library
(`src/patterns/library/refund_approval/refund_approval.workflow.json`),
not from the fixtures the two above come from. A person can start a
workflow from this one, so it is the shape they are shown before they
have changed anything.

```json
{
  "$schema": "https://mboss.dev/schemas/workflow-v1.json",
  "version": 1,
  "revision": 1,
  "name": "refund_approval",
  "title": "Refund approval",
  "nodes": [
    { "id": "refund_requested", "kind": "trigger",
      "title": "Refund requested",
      "config": { "mode": "event", "topic": "refund.requested",
        "idempotencyKeyPath": "refundId",
        "requesterEmailPath": "customer.email" },
      "out": "RefundRequest" },
    { "id": "load_purchase", "kind": "step", "title": "Load purchase",
      "handler": { "export": "getPurchase" },
      "in": "RefundRequest", "out": "Purchase", "config": {} },
    { "id": "evaluate_refund", "kind": "branch",
      "title": "Evaluate refund", "in": "Purchase",
      "handler": { "export": "refundPolicy" },
      "config": { "cases": [
        { "port": "auto_approve",
          "when": { "path": "", "op": "eq", "value": "auto_approve" } },
        { "port": "review",
          "when": { "path": "", "op": "eq", "value": "review" } } ],
        "elsePort": "else" } },
    { "id": "request_approval", "kind": "approval",
      "title": "Request approval",
      "config": { "to": "support@example.com",
        "subject": "Approve this refund?",
        "message": "A refund needs a decision. Open the link to approve or reject it.",
        "timeoutDays": 7 } },
    { "id": "refund_payment", "kind": "apiCall", "title": "Refund payment",
      "handler": { "export": "refundPayment" },
      "in": "Purchase", "out": "RefundResult",
      "config": { "service": "payments" } },
    { "id": "update_order", "kind": "transaction", "title": "Update order",
      "handler": { "export": "markRefunded" },
      "in": "RefundResult", "out": "Order", "config": {} },
    { "id": "email_customer", "kind": "emailSend", "title": "Email customer",
      "config": { "to": "requestingUser",
        "subject": "Your refund is on its way",
        "bodyMarkdown": "We have refunded your order. The amount will reach your original payment method in a few days.",
        "attach": { "type": "none" } } },
    { "id": "email_denial", "kind": "emailSend", "title": "Email denial",
      "config": { "to": "requestingUser",
        "subject": "About your refund request",
        "bodyMarkdown": "We looked at your request and could not approve it. Reply to this email if you have questions.",
        "attach": { "type": "none" } } }
  ],
  "edges": [
    { "id": "e1", "from": { "node": "refund_requested", "port": "out" },
      "to": { "node": "load_purchase" }, "type": "RefundRequest" },
    { "id": "e2", "from": { "node": "load_purchase", "port": "out" },
      "to": { "node": "evaluate_refund" }, "type": "Purchase" },
    { "id": "e3", "from": { "node": "evaluate_refund", "port": "auto_approve" },
      "to": { "node": "refund_payment" }, "type": "Purchase" },
    { "id": "e4", "from": { "node": "evaluate_refund", "port": "review" },
      "to": { "node": "request_approval" } },
    { "id": "e5", "from": { "node": "request_approval", "port": "approved" },
      "to": { "node": "refund_payment" }, "type": "Purchase" },
    { "id": "e6", "from": { "node": "request_approval", "port": "rejected" },
      "to": { "node": "email_denial" } },
    { "id": "e7", "from": { "node": "refund_payment", "port": "out" },
      "to": { "node": "update_order" }, "type": "RefundResult" },
    { "id": "e8", "from": { "node": "update_order", "port": "out" },
      "to": { "node": "email_customer" }, "type": "Order" }
  ]
}
```

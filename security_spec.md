# Security Specification for Caller AI

## Data Invariants
1. A user can only read and write their own profile.
2. A user can only read and write their own contacts, calls, and recordings.
3. Users can read all community contacts.
4. Only the creator can update or delete a community contact.
5. Credits can only be updated by the system (simulated here by limiting profile updates to non-credit fields for normal users, but since we don't have a backend, we'll allow users to "recharge" or we'll manage it carefully).
6. Timestamps must be server-validated.

## Key collections
- `/users/{userId}`: User profile.
- `/users/{userId}/contacts/{contactId}`: User's private contacts.
- `/community/{contactId}`: Shared community contacts.
- `/users/{userId}/calls/{callId}`: User's call history.
- `/users/{userId}/recordings/{recordingId}`: User's call recordings and transcripts.

## Rule Helpers
- `isSignedIn()`: Check if user is authenticated.
- `isOwner(userId)`: Check if the authenticated user matches the userId.
- `isValidUserProfile(data)`: Validates user profile schema.
- `isValidContact(data)`: Validates contact schema.
- `isValidCommunityContact(data)`: Validates community contact schema.
- `isValidCall(data)`: Validates call record schema.
- `isValidRecording(data)`: Validates recording schema.

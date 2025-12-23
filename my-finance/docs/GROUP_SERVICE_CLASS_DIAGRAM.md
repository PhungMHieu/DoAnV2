# Group Service - Sơ đồ lớp thực thể

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────┐
│                      Group                          │
│                   (groups table)                    │
├─────────────────────────────────────────────────────┤
│  PK   id: string (UUID)                             │
├─────────────────────────────────────────────────────┤
│       name: string (varchar 100)                    │
│       code: string (varchar 20, unique)             │
│       createdByUserId: string                       │
│       isLocked: boolean (default: false)            │
│       createdAt: Date                               │
│       updatedAt: Date                               │
├─────────────────────────────────────────────────────┤
│  1──┐                                               │
│     │  OneToMany: members                           │
└─────│───────────────────────────────────────────────┘
      │
      │
      │ N
┌─────▼───────────────────────────────────────────────┐
│                   GroupMember                       │
│              (group_members table)                  │
├─────────────────────────────────────────────────────┤
│  PK   id: number (auto-increment)                   │
│  FK   group: Group (group_id)                       │
├─────────────────────────────────────────────────────┤
│       name: string (varchar 100)                    │
│       userId: string | null (indexed)               │
│       joined: boolean (default: false)              │
│       joinedAt: Date | null                         │
│       createdAt: Date                               │
│       updatedAt: Date                               │
└─────────────────────────────────────────────────────┘
```

## Mối quan hệ

```
┌───────────┐         1:N          ┌─────────────────┐
│   Group   │ ──────────────────── │   GroupMember   │
└───────────┘                      └─────────────────┘
     │                                     │
     │ createdByUserId                     │ userId
     │                                     │
     ▼                                     ▼
┌─────────────────────────────────────────────────────┐
│                  User (auth-service)                │
│               (external reference)                  │
└─────────────────────────────────────────────────────┘
```

## Chi tiết các Entity

### Group Entity

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | ID duy nhất của group |
| `name` | varchar(100) | NOT NULL | Tên nhóm |
| `code` | varchar(20) | UNIQUE, NOT NULL | Mã mời tham gia nhóm |
| `createdByUserId` | varchar | NOT NULL | ID user tạo nhóm (owner) |
| `isLocked` | boolean | default: false | Khóa nhóm (không cho join) |
| `createdAt` | timestamp | auto | Thời gian tạo |
| `updatedAt` | timestamp | auto | Thời gian cập nhật |

### GroupMember Entity

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | integer | PK, auto-increment | ID member |
| `group` | Group | FK → groups.id, CASCADE | Nhóm mà member thuộc về |
| `name` | varchar(100) | NOT NULL | Tên hiển thị trong nhóm |
| `userId` | varchar | NULLABLE, indexed | ID user thực (sau khi join) |
| `joined` | boolean | default: false | Đã join hay chưa |
| `joinedAt` | timestamptz | NULLABLE | Thời điểm join |
| `createdAt` | timestamp | auto | Thời gian tạo |
| `updatedAt` | timestamp | auto | Thời gian cập nhật |

## DTO Classes

```
┌─────────────────────────────────────────────────────┐
│                  CreateGroupDto                     │
├─────────────────────────────────────────────────────┤
│  @IsString @IsNotEmpty                              │
│  name: string           // Tên nhóm                 │
│                                                     │
│  @IsString @IsNotEmpty                              │
│  ownerName: string      // Tên owner trong nhóm    │
│                                                     │
│  @IsArray @ArrayMinSize(1)                          │
│  memberNames: string[]  // Danh sách tên members    │
└─────────────────────────────────────────────────────┘
```

## Luồng hoạt động

### 1. Tạo nhóm mới

```
User ──► CreateGroupDto ──► Group + GroupMembers
         {                   │
           name,             ├─► Group { name, code, createdByUserId }
           ownerName,        │
           memberNames[]     └─► GroupMember[] (owner + members)
         }                         - owner: { joined: true, userId: set }
                                   - members: { joined: false, userId: null }
```

### 2. Tham gia nhóm (Join)

```
User + Code ──► Find Group by code
                      │
                      ▼
              Find/Create GroupMember
                      │
                      ▼
              Update: { joined: true, userId: set, joinedAt: now }
```

### 3. Trạng thái Member

```
┌─────────────────────────────────────────────────────────────┐
│                    Member States                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   PENDING (chưa join)           JOINED (đã join)            │
│   ┌─────────────────┐           ┌─────────────────┐         │
│   │ joined: false   │  ──────►  │ joined: true    │         │
│   │ userId: null    │   join    │ userId: "xxx"   │         │
│   │ joinedAt: null  │           │ joinedAt: Date  │         │
│   └─────────────────┘           └─────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema (PostgreSQL)

```sql
-- Table: groups
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    created_by_user_id VARCHAR NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: group_members
CREATE TABLE group_members (
    id SERIAL PRIMARY KEY,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    user_id VARCHAR,
    joined BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookup by user
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
```

## Quan hệ với các Service khác

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐
│  auth-service   │     │  group-service  │     │ transaction-service │
│                 │     │                 │     │                     │
│  User { id }    │◄────│  Group          │────►│  GroupExpense       │
│                 │     │  GroupMember    │     │  (chi tiêu nhóm)    │
└─────────────────┘     └─────────────────┘     └─────────────────────┘
        │                       │
        │    userId             │ createdByUserId
        │    references         │ userId
        ▼                       ▼
   ┌────────────────────────────────────────┐
   │           User ID (UUID string)        │
   │      (Shared across microservices)     │
   └────────────────────────────────────────┘
```

---

## Sơ đồ tuần tự (Sequence Diagrams)

### 1. Luồng tạo nhóm mới (POST /groups)

```
┌────────┐      ┌─────────────┐      ┌─────────────┐      ┌──────────┐
│ Client │      │   Group     │      │   Group     │      │ Database │
│        │      │ Controller  │      │   Service   │      │(Postgres)│
└───┬────┘      └──────┬──────┘      └──────┬──────┘      └────┬─────┘
    │                  │                    │                   │
    │ POST /groups     │                    │                   │
    │ {                │                    │                   │
    │   name,          │                    │                   │
    │   ownerName,     │                    │                   │
    │   memberNames[]  │                    │                   │
    │ }                │                    │                   │
    ├─────────────────>│                    │                   │
    │                  │                    │                   │
    │                  │ getUserId(req)     │                   │
    │                  │ (from JWT)         │                   │
    │                  ├────────┐           │                   │
    │                  │        │           │                   │
    │                  │<───────┘           │                   │
    │                  │                    │                   │
    │                  │ Validate DTO       │                   │
    │                  │ CreateGroupDto     │                   │
    │                  ├────────┐           │                   │
    │                  │        │           │                   │
    │                  │<───────┘           │                   │
    │                  │                    │                   │
    │                  │ createGroup()      │                   │
    │                  ├───────────────────>│                   │
    │                  │                    │                   │
    │                  │                    │ generateGroupCode()
    │                  │                    ├────────┐          │
    │                  │                    │        │          │
    │                  │                    │<───────┘          │
    │                  │                    │                   │
    │                  │                    │ Create Group      │
    │                  │                    │ { name, code,     │
    │                  │                    │   createdByUserId }
    │                  │                    ├──────────────────>│
    │                  │                    │                   │
    │                  │                    │ INSERT Group      │
    │                  │                    │                   │
    │                  │                    │ Saved Group       │
    │                  │                    │<──────────────────┤
    │                  │                    │                   │
    │                  │          ┌─────────────────────────────────┐
    │                  │          │ Create Owner Member             │
    │                  │          │ { name: ownerName,              │
    │                  │          │   userId: createdByUserId,      │
    │                  │          │   joined: true,                 │
    │                  │          │   joinedAt: now() }             │
    │                  │          └─────────────────────────────────┘
    │                  │                    │                   │
    │                  │                    │ INSERT Owner      │
    │                  │                    │ GroupMember       │
    │                  │                    ├──────────────────>│
    │                  │                    │                   │
    │                  │          ┌─────────────────────────────────┐
    │                  │          │ Create Other Members            │
    │                  │          │ for each in memberNames:        │
    │                  │          │ { name: memberName,             │
    │                  │          │   joined: false,                │
    │                  │          │   userId: null }                │
    │                  │          └─────────────────────────────────┘
    │                  │                    │                   │
    │                  │                    │ INSERT Members    │
    │                  │                    │ (bulk)            │
    │                  │                    ├──────────────────>│
    │                  │                    │                   │
    │                  │                    │ Saved Members     │
    │                  │                    │<──────────────────┤
    │                  │                    │                   │
    │                  │                    │ getGroupByCode()  │
    │                  │                    ├────────┐          │
    │                  │                    │        │          │
    │                  │                    │ SELECT Group      │
    │                  │                    │ WITH members      │
    │                  │                    ├──────────────────>│
    │                  │                    │                   │
    │                  │                    │ Group + Members   │
    │                  │                    │<──────────────────┤
    │                  │                    │        │          │
    │                  │                    │<───────┘          │
    │                  │                    │                   │
    │                  │ Group              │                   │
    │                  │<───────────────────┤                   │
    │                  │                    │                   │
    │ Response:        │                    │                   │
    │ {                │                    │                   │
    │   id,            │                    │                   │
    │   name,          │                    │                   │
    │   code,          │                    │                   │
    │   createdByUserId,│                   │                   │
    │   isLocked: false│                    │                   │
    │ }                │                    │                   │
    │<─────────────────┤                    │                   │
    │                  │                    │                   │
```

### 2. Luồng tham gia nhóm (POST /groups/join)

```
┌────────┐      ┌─────────────┐      ┌─────────────┐      ┌──────────┐
│ Client │      │   Group     │      │   Group     │      │ Database │
│        │      │ Controller  │      │   Service   │      │(Postgres)│
└───┬────┘      └──────┬──────┘      └──────┬──────┘      └────┬─────┘
    │                  │                    │                   │
    │ POST /groups/join│                    │                   │
    │ {                │                    │                   │
    │   groupCode,     │                    │                   │
    │   memberId       │                    │                   │
    │ }                │                    │                   │
    ├─────────────────>│                    │                   │
    │                  │                    │                   │
    │                  │ getUserId(req)     │                   │
    │                  │ (from JWT)         │                   │
    │                  ├────────┐           │                   │
    │                  │        │           │                   │
    │                  │<───────┘           │                   │
    │                  │                    │                   │
    │                  │ Validate DTO       │                   │
    │                  │ JoinGroupDto       │                   │
    │                  ├────────┐           │                   │
    │                  │        │           │                   │
    │                  │<───────┘           │                   │
    │                  │                    │                   │
    │                  │ joinGroupByCode()  │                   │
    │                  ├───────────────────>│                   │
    │                  │                    │                   │
    │                  │                    │ getGroupByCode()  │
    │                  │                    ├────────┐          │
    │                  │                    │        │          │
    │                  │                    │ SELECT Group      │
    │                  │                    │ WHERE code = ?    │
    │                  │                    │ WITH members      │
    │                  │                    ├──────────────────>│
    │                  │                    │                   │
    │                  │                    │ Group + Members   │
    │                  │                    │<──────────────────┤
    │                  │                    │        │          │
    │                  │                    │<───────┘          │
    │                  │                    │                   │
    │                  │         ┌──────────────────────────────┐
    │                  │         │ Find member by ID            │
    │                  │         │ members.find(m => m.id == ?) │
    │                  │         └──────────────────────────────┘
    │                  │                    │                   │
    │                  │                    │ Validate:         │
    │                  │                    │ - member exists?  │
    │                  │                    │ - already joined? │
    │                  │                    ├────────┐          │
    │                  │                    │        │          │
    │                  │                    │<───────┘          │
    │                  │                    │                   │
    │                  │         ┌──────────────────────────────┐
    │                  │         │ Update member:               │
    │                  │         │ - userId = currentUserId     │
    │                  │         │ - joined = true              │
    │                  │         │ - joinedAt = now()           │
    │                  │         └──────────────────────────────┘
    │                  │                    │                   │
    │                  │                    │ UPDATE            │
    │                  │                    │ group_members     │
    │                  │                    │ SET userId=?,     │
    │                  │                    │     joined=true,  │
    │                  │                    │     joinedAt=now()│
    │                  │                    │ WHERE id=?        │
    │                  │                    ├──────────────────>│
    │                  │                    │                   │
    │                  │                    │ Updated Member    │
    │                  │                    │<──────────────────┤
    │                  │                    │                   │
    │                  │ GroupMember        │                   │
    │                  │<───────────────────┤                   │
    │                  │                    │                   │
    │                  │ Build Response     │                   │
    │                  ├────────┐           │                   │
    │                  │        │           │                   │
    │                  │<───────┘           │                   │
    │                  │                    │                   │
    │ Response:        │                    │                   │
    │ {                │                    │                   │
    │   groupId,       │                    │                   │
    │   memberId,      │                    │                   │
    │   name,          │                    │                   │
    │   userId,        │                    │                   │
    │   joined: true,  │                    │                   │
    │   joinedAt       │                    │                   │
    │ }                │                    │                   │
    │<─────────────────┤                    │                   │
    │                  │                    │                   │
```

### 3. Luồng lấy thông tin nhóm theo code (GET /groups/join/:code)

```
┌────────┐      ┌─────────────┐      ┌─────────────┐      ┌──────────┐
│ Client │      │   Group     │      │   Group     │      │ Database │
│        │      │ Controller  │      │   Service   │      │(Postgres)│
└───┬────┘      └──────┬──────┘      └──────┬──────┘      └────┬─────┘
    │                  │                    │                   │
    │ GET /groups/join │                    │                   │
    │      /:code      │                    │                   │
    ├─────────────────>│                    │                   │
    │                  │                    │                   │
    │                  │ getGroupByCode()   │                   │
    │                  ├───────────────────>│                   │
    │                  │                    │                   │
    │                  │                    │ SELECT Group      │
    │                  │                    │ WHERE code = ?    │
    │                  │                    │ WITH members      │
    │                  │                    ├──────────────────>│
    │                  │                    │                   │
    │                  │                    │ Group + Members   │
    │                  │                    │<──────────────────┤
    │                  │                    │                   │
    │                  │ Group              │                   │
    │                  │<───────────────────┤                   │
    │                  │                    │                   │
    │                  │ Map Response       │                   │
    │                  ├────────┐           │                   │
    │                  │        │           │                   │
    │                  │<───────┘           │                   │
    │                  │                    │                   │
    │ Response:        │                    │                   │
    │ {                │                    │                   │
    │   groupId,       │                    │                   │
    │   name,          │                    │                   │
    │   code,          │                    │                   │
    │   isLocked,      │                    │                   │
    │   members: [     │                    │                   │
    │     {id, name,   │                    │                   │
    │      userId,     │                    │                   │
    │      joined}     │                    │                   │
    │   ]              │                    │                   │
    │ }                │                    │                   │
    │<─────────────────┤                    │                   │
    │                  │                    │                   │
```

### 4. Luồng lấy danh sách nhóm của user (GET /groups/my)

```
┌────────┐      ┌─────────────┐      ┌─────────────┐      ┌──────────┐
│ Client │      │   Group     │      │   Group     │      │ Database │
│        │      │ Controller  │      │   Service   │      │(Postgres)│
└───┬────┘      └──────┬──────┘      └──────┬──────┘      └────┬─────┘
    │                  │                    │                   │
    │ GET /groups/my   │                    │                   │
    ├─────────────────>│                    │                   │
    │                  │                    │                   │
    │                  │ getUserId(req)     │                   │
    │                  │ (from JWT)         │                   │
    │                  ├────────┐           │                   │
    │                  │        │           │                   │
    │                  │<───────┘           │                   │
    │                  │                    │                   │
    │                  │ getGroupsOfUser()  │                   │
    │                  ├───────────────────>│                   │
    │                  │                    │                   │
    │                  │                    │ SELECT            │
    │                  │                    │ GroupMembers      │
    │                  │                    │ WHERE userId = ?  │
    │                  │                    │ WITH group        │
    │                  │                    ├──────────────────>│
    │                  │                    │                   │
    │                  │                    │ GroupMembers      │
    │                  │                    │ + Groups          │
    │                  │                    │<──────────────────┤
    │                  │                    │                   │
    │                  │                    │ Extract groups    │
    │                  │                    │ from members      │
    │                  │                    ├────────┐          │
    │                  │                    │        │          │
    │                  │                    │<───────┘          │
    │                  │                    │                   │
    │                  │ Groups[]           │                   │
    │                  │<───────────────────┤                   │
    │                  │                    │                   │
    │                  │ Map to response    │                   │
    │                  ├────────┐           │                   │
    │                  │        │           │                   │
    │                  │<───────┘           │                   │
    │                  │                    │                   │
    │ Response:        │                    │                   │
    │ [                │                    │                   │
    │   {id, name,     │                    │                   │
    │    code},        │                    │                   │
    │   ...            │                    │                   │
    │ ]                │                    │                   │
    │<─────────────────┤                    │                   │
    │                  │                    │                   │
```

---

## Ghi chú kỹ thuật

### Validation với DTO
- **CreateGroupDto**: Tự động validate `name`, `ownerName`, `memberNames[]` với `class-validator`
- **JoinGroupDto**: Tự động validate `groupCode`, `memberId`
- NestJS ValidationPipe tự động reject request nếu DTO không hợp lệ

### Authentication
- Tất cả endpoints đều require JWT authentication
- `getUserIdFromRequest()` extract userId từ JWT token
- Nếu thiếu/invalid token → 401 Unauthorized

### Group Code Generation
- Random 6-character alphanumeric code (uppercase)
- Unique constraint trong database
- Format: `ABC123`, `XYZ789`, etc.

### Member States
- **PENDING**: `joined: false`, `userId: null` - Slot chưa được claim
- **JOINED**: `joined: true`, `userId: set` - User đã join vào slot

### Database Operations
- **Create Group**:
  - 1 INSERT vào `groups` table
  - N+1 INSERTs vào `group_members` (owner + N members)
- **Join Group**:
  - 1 SELECT để tìm group và members
  - 1 UPDATE để cập nhật member status
- **Relations**:
  - TypeORM eager loading với `relations: ['members']`
  - Cascade delete: Xóa group → tự động xóa members

# Hướng dẫn sử dụng pgAdmin

## 1. Truy cập pgAdmin

Mở trình duyệt và truy cập: **http://localhost:5050**

## 2. Đăng nhập

| Field    | Value                 |
|----------|----------------------|
| Email    | `admin@myfinance.com` |
| Password | `admin123`            |

## 3. Kết nối Database

### Bước 1: Tạo Server mới
- Click chuột phải vào **Servers** ở panel bên trái
- Chọn **Register** → **Server...**

### Bước 2: Điền thông tin

**Tab General:**
| Field | Value       |
|-------|-------------|
| Name  | `my-finance` |

**Tab Connection:**
| Field              | Value           |
|--------------------|-----------------|
| Host name/address  | `postgres`      |
| Port               | `5432`          |
| Maintenance database | `myfinance_db` |
| Username           | `myfinance_user` |
| Password           | `myfinance_pass` |

> ⚠️ **Lưu ý:** Host phải là `postgres` (tên container trong Docker network), không phải `localhost`

### Bước 3: Lưu
- Tick vào **Save password** (tùy chọn)
- Click **Save**

## 4. Các bảng trong Database

Sau khi kết nối thành công, navigate đến:
```
Servers → my-finance → Databases → myfinance_db → Schemas → public → Tables
```

### Danh sách bảng:

| Bảng             | Mô tả                          |
|------------------|--------------------------------|
| `users`          | Thông tin người dùng           |
| `accounts`       | Tài khoản tài chính            |
| `transactions`   | Giao dịch thu chi              |
| `groups`         | Nhóm chia sẻ chi phí           |
| `group_members`  | Thành viên trong nhóm          |

## 5. Chạy Query

### Cách 1: Query Tool
1. Click chuột phải vào database `myfinance_db`
2. Chọn **Query Tool**
3. Nhập SQL và nhấn **F5** hoặc click **▶ Execute**

### Cách 2: Xem dữ liệu trực tiếp
1. Click chuột phải vào bảng (ví dụ: `users`)
2. Chọn **View/Edit Data** → **All Rows**

## 6. Một số Query hữu ích

```sql
-- Xem tất cả users
SELECT id, username, email, role, created_at FROM users;

-- Xem tất cả transactions của 1 user
SELECT * FROM transactions WHERE user_id = 'your-user-id';

-- Xem số dư tài khoản
SELECT * FROM accounts;

-- Xem các nhóm
SELECT * FROM groups;

-- Xem thành viên trong nhóm
SELECT gm.*, g.name as group_name 
FROM group_members gm 
JOIN groups g ON gm.group_id = g.id;

-- Thống kê giao dịch theo category
SELECT category, COUNT(*) as count, SUM(amount) as total
FROM transactions
GROUP BY category
ORDER BY total DESC;
```

## 7. Troubleshooting

### Không kết nối được?

1. **Kiểm tra container đang chạy:**
   ```bash
   docker compose ps
   ```

2. **Kiểm tra logs postgres:**
   ```bash
   docker logs my-finance-postgres
   ```

3. **Kiểm tra network:**
   ```bash
   docker network inspect my-finance_my-finance-network
   ```

### Lỗi "role does not exist"?
- Đảm bảo dùng đúng username: `myfinance_user`
- Host phải là `postgres`, không phải `localhost`

## 8. Ports

| Service   | Port  |
|-----------|-------|
| pgAdmin   | 5050  |
| PostgreSQL (Docker) | 5433 (external) / 5432 (internal) |

---

**Tip:** Bookmark http://localhost:5050 để truy cập nhanh pgAdmin!

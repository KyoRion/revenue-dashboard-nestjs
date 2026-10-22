# Revenue Dashboard

Ứng dụng dashboard doanh thu gồm frontend Next.js, API NestJS và PostgreSQL. Toàn bộ môi trường phát triển được chạy bằng Docker Compose.

## Yêu cầu

- [Docker Engine](https://docs.docker.com/engine/install/) và Docker Compose v2 (`docker compose`)
- Git
- Cổng `3000`, `3001` và `5432` còn trống

## Clone và cấu hình

```bash
git clone https://github.com/KyoRion/revenue-dashboard-nestjs.git
cd revenue-dashboard-nestjs
cp .env.example .env
```

Mở `.env` và thay các giá trị dùng cho môi trường của bạn, đặc biệt là `POSTGRES_PASSWORD`, `JWT_SECRET`, `ADMIN_EMAIL` và `ADMIN_PASSWORD`.

`LOCAL_UID` và `LOCAL_GID` giúp các file được tạo trong container có đúng quyền của người dùng hiện tại trên Linux. Có thể thiết lập tự động bằng:

```bash
sed -i "s/^LOCAL_UID=.*/LOCAL_UID=$(id -u)/; s/^LOCAL_GID=.*/LOCAL_GID=$(id -g)/" .env
```

Trên macOS hoặc Windows, có thể giữ giá trị mặc định nếu Docker Desktop chạy bình thường.

## Chạy ứng dụng với Docker

Build image và khởi động database, API và web:

```bash
docker compose up --build -d
```

Theo dõi log đến khi các dịch vụ sẵn sàng:

```bash
docker compose logs -f
```

Sau khi chạy xong, truy cập:

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1
- PostgreSQL: `localhost:5432`

Tài khoản admin: 
- Email: admin@admin.com
- Password: 123123123

## Migrate và seed database

Chạy migration đã có trong source:

```bash
docker compose exec api npx prisma migrate deploy
```

Tạo hoặc cập nhật tài khoản admin từ `ADMIN_EMAIL` và `ADMIN_PASSWORD` trong `.env`:

```bash
docker compose exec \
  -e ADMIN_EMAIL="$(grep '^ADMIN_EMAIL=' .env | cut -d '=' -f2-)" \
  -e ADMIN_PASSWORD="$(grep '^ADMIN_PASSWORD=' .env | cut -d '=' -f2-)" \
  api npx prisma db seed
```

Lệnh seed có thể chạy lại an toàn: tài khoản admin được cập nhật theo email nếu đã tồn tại.

Để kiểm tra nhanh API sau khi migrate:

```bash
curl http://localhost:3001/api/v1
```

## Các lệnh hữu ích

```bash
# Dừng dịch vụ, giữ lại dữ liệu PostgreSQL
docker compose down

# Xem trạng thái container
docker compose ps

# Mở shell trong API container
docker compose exec api sh

# Xóa toàn bộ dữ liệu cục bộ rồi chạy lại từ đầu
docker compose down -v
```

> `docker compose down -v` sẽ xóa PostgreSQL volume; chỉ dùng khi bạn muốn bỏ toàn bộ dữ liệu local.

## Cấu trúc thư mục

```text
apps/
├── api/  # NestJS API, Prisma schema, migrations và seed
└── web/  # Next.js dashboard
```

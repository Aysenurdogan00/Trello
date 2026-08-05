# Trello
Akıllı Görev ve Proje Yönetim Sistemi

Ekiplerin görev oluşturduğu, takip ettiği ve sürükle-bırak (Kanban) mantığıyla çalışan çok platformlu iş yönetim sistemi.

## Proje Özellikleri (Step 1 - Analiz & Tasarım)

### 1. Kanban İş Akışı
* **To Do:** Henüz başlanmamış görevler.
* **Doing:** Aktif olarak çalışılan görevler.
* **Done:** Tamamlanan görevler.

### 2. User Stories (Kullanıcı Hikayeleri)
* **US-01:** Kullanıcı sisteme kaydolabilir ve giriş yapabilir.
* **US-02:** Kullanıcı yeni proje oluşturabilir ve projelerini listeleyebilir.
* **US-03:** Kullanıcı bir projeye yeni görevler ekleyebilir.
* **US-04:** Kullanıcı görevlerin durumunu ("todo", "doing", "done") güncelleyebilir.
* **US-05:** Kullanıcı görev detaylarını güncelleyebilir veya silebilir.
* **US-06:** Admin tüm kullanıcıları, projeleri ve görevleri yönetebilir.

---

## Veritabanı Yapısı (ER Diagram / Tablolar)

### Users (Kullanıcılar)
* `id` (Primary Key)
* `username` (VARCHAR)
* `email` (VARCHAR, Unique)
* `password_hash` (VARCHAR)
* `role` ('admin', 'user')

### Projects (Projeler)
* `id` (Primary Key)
* `title` (VARCHAR)
* `description` (TEXT)
* `owner_id` (Foreign Key -> Users.id)

### Tasks (Görevler)
* `id` (Primary Key)
* `title` (VARCHAR)
* `description` (TEXT)
* `status` ('todo', 'doing', 'done')
* `project_id` (Foreign Key -> Projects.id)
* `assigned_user_id` (Foreign Key -> Users.id)

---

## API Endpoint Planı

| Metot | Endpoint | Açıklama | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Yeni kullanıcı kaydı | Hayır |
| `POST` | `/api/auth/login` | Giriş yapma ve JWT alımı | Hayır |
| `GET` | `/api/projects` | Kullanıcının projelerini getirme | Evet |
| `POST` | `/api/projects` | Yeni proje oluşturma | Evet |
| `GET` | `/api/projects/:id/tasks` | Projenin görevlerini getirme | Evet |
| `POST` | `/api/tasks` | Yeni görev ekleme | Evet |
| `PUT` | `/api/tasks/:id` | Görev güncelleme | Evet |
| `DELETE` | `/api/tasks/:id` | Görev silme | Evet |

---

## Fake API (JSON Server) Kurulumu

Projenin frontend tarafını geliştirmek için sahte API `json-server` ile yapılandırılmıştır.

### Çalıştırma Adımları:
1. Gerekli paketi yükleyin:
   ```bash
   npm install -g json-server
   ```
2. Sahte sunucuyu başlatın:
   ```bash
   npx json-server --watch db.json --port 5000
   ```

Akıllı Görev ve Proje Yönetim Sistemi adını verdiğim bu projeyi, ekiplerin günlük iş süreçlerini sürükle-bırak mantığıyla çalışan bir Kanban panosu üzerinden verimli şekilde takip edebilmeleri için geliştirdim. Trello ve Jira gibi popüler iş yönetim araçlarının sunduğu kullanıcı deneyimini inceleyerek projenin veritabanı mimarisinden canlı ortama dağıtımına kadar olan tüm süreçleri uçtan uca kurguladım.  

Sistemin arka planında yüksek performanslı ve esnek bir REST API mimarisi sunabilmek adına Node.js ve Express kullandım. Veri bütünlüğünü sağlamak ve ilişkisel veri yapısını güvenli bir şekilde yönetmek için veritabanı tarafında PostgreSQL, veritabanı erişim katmanında ise Prisma ORM tercih ettim. Kullanıcıların üyelik aşamasında güvenliğini ön planda tutarak 6 haneli bir e-posta doğrulama kodu akışı tasarladım. Bu e-posta iletimlerinin sorunsuz gerçekleşmesi için backend mimarisine Resend HTTP API entegrasyonunu dahil ettim.  

Projenin çoklu platform desteği sunabilmesi adına kullanıcı arayüzünü hem mobil hem de masaüstü ortamlara taşıdım. Mobil tarafta React Native ve Expo altyapısından yararlanarak canlı backend ile haberleşen bir mobil uygulama geliştirdim ve Expo EAS Build araçları yardımıyla kuruluma hazır bağımsız bir Android APK dosyası ürettim. Masaüstü tarafında ise web ve API katmanını Electron altyapısıyla sarmalayarak uygulamanın masaüstü ortamında da sorunsuz bir şekilde çalışmasını sağladım.

Güvenlik tarafında ise endüstri standardı olan uygulamaları projeye aktardım. Kullanıcı parolalarını veritabanında asla açık metin olarak saklamayıp Bcrypt.js ile güçlü bir şekilde hashledim. Oturum yönetimini JWT ile sağlarken, API uç noktalarını kaba kuvvet saldırılarına ve yaygın web zafiyetlerine karşı korumak adına Helmet ve Express Rate Limit katmanlarını sisteme ekledim. Geliştirdiğim bu yapıyı Render Cloud platformu üzerinde canlıya alarak erişilebilir durumda dağıtımını tamamladım.  

Proje Bağlantıları
Live Backend API: https://trello-clone-backend-cs8r.onrender.com/api
Database: Render Cloud PostgreSQL  

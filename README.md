# 🐜 Ant Rumble! · Kiến Ơi Kiến Ầm!

Game web vui nhộn: dẫn cả đàn kiến tí hon đi ăn vụn bánh, chui qua cổng nhân/chia, khiêng mồi to và hạ trùm!
A cute, chaotic swarm game: lead a tiny ant army, munch crumbs, pick the right gates and beat the boss!

**▶ Chơi ngay / Play:** https://thanhphong3.github.io/Ant-game/

## Cách chơi / How to play
- **Kéo / vuốt** (hoặc phím ← →) để dẫn đàn kiến. / **Drag / swipe** (or ← → keys) to steer.
- 🍞 Vụn bánh = thêm kiến · 🟩 cổng `+` `×` tốt · 🟥 cổng `−` `÷` xấu.
- 🪲 Đội bọ cánh cứng: đánh nhau kiểu số đông, thắng được thưởng mật.
- 🍉 Mồi to: cần đủ số kiến, vài con sẽ khiêng về tổ để đổi lấy nhiều mật.
- 🦶 Coi chừng bàn chân khổng lồ, cái thìa, cục tẩy, hạt đậu lăn…
- ❓ Cổng bí ẩn: đổi vận may — có thể là ×2, ×3… hoặc một cú lừa!
- 🫧 Power-up: 🛡️ khiên bong bóng (miễn nhiễm bẫy), 🧲 siêu nam châm, 🔥 kiến nổi giận (x2 sức đánh).
- 🔥 Ăn liền 10 vụn bánh để vào chế độ **CUỒNG NHIỆT**: kiến vàng óng, mỗi vụn bánh x2 kiến.
- 👑 Cuối màn: đánh trùm (Nhện, Ếch, Thằn lằn, Vua Bọ Hung). Trùm sẽ đập xuống một bên sân — kéo đàn kiến sang phía an toàn để né và **phản đòn**!
- ⭐ Thắng màn được chấm 1–3 sao theo số kiến còn lại, sao càng nhiều mật càng nhiều.

## Tính năng / Features
- Màn chơi vô hạn, sinh ngẫu nhiên theo seed, 5 bối cảnh: khăn picnic, bàn bếp, vườn, sàn gỗ, xứ kẹo.
- 🏠 Tổ kiến: 5 nâng cấp (đàn khởi đầu, sức mạnh, nam châm, giáp lá, hũ mật).
- 🐜 Bộ sưu tập 8 kiến đội trưởng với kỹ năng riêng (Nón Lá, Ninja, Béo, DJ, Phi Hành Gia, Hiệp Sĩ, Vua…).
- Power-up, cổng bí ẩn, chế độ cuồng nhiệt, trùm biết ra đòn và chấm sao. Rung nhẹ trên điện thoại khi trúng đòn.
- 📅 Thử thách ngày: cùng một màn cho mọi người mỗi ngày, lưu kỷ lục.
- Tiếng Việt / English, nhạc và hiệu ứng âm thanh tự tổng hợp (Web Audio), lưu tiến trình bằng localStorage.
- Toàn bộ hình vẽ bằng code (canvas), phong cách doodle nét rung rinh, không cần file ảnh.

## Phát triển / Development
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output in dist/
```

Tech: TypeScript + Vite + Canvas 2D.

## Deploy
Mỗi lần push lên `main`, GitHub Actions (`.github/workflows/deploy.yml`) tự build và đưa lên GitHub Pages.
Lần đầu cần bật: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

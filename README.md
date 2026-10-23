# 🐜 Ant Rumble! · Kiến Ơi Kiến Ầm!

Game web vui nhộn: dẫn cả đàn kiến tí hon đi ăn vụn bánh, chui qua cổng nhân/chia, khiêng mồi to và hạ trùm!
A cute, chaotic swarm game: lead a tiny ant army, munch crumbs, pick the right gates and beat the boss!

**▶ Chơi ngay / Play:** https://thanhphong3.github.io/ant-game/

## Cách chơi / How to play
- **Kéo / vuốt** (hoặc phím ← →) để dẫn đàn kiến. / **Drag / swipe** (or ← → keys) to steer.
- 🍞 Vụn bánh = thêm kiến · 🟩 cổng `+` `×` tốt · 🟥 cổng `−` `÷` xấu.
- 🪲 Đội bọ cánh cứng: đánh nhau kiểu số đông, thắng được thưởng mật.
- 🍉 Mồi to: cần đủ số kiến, vài con sẽ khiêng về tổ để đổi lấy nhiều mật.
- 🦶 Coi chừng bàn chân khổng lồ, cái thìa, cục tẩy, hạt đậu lăn…
- 👑 Cuối màn: đánh trùm (Nhện, Ếch, Thằn lằn, Vua Bọ Hung). Kiến còn lại × sức mạnh phải lớn hơn máu trùm.

## Tính năng / Features
- Màn chơi vô hạn, sinh ngẫu nhiên theo seed, 5 bối cảnh: khăn picnic, bàn bếp, vườn, sàn gỗ, xứ kẹo.
- 🏠 Tổ kiến: 5 nâng cấp (đàn khởi đầu, sức mạnh, nam châm, giáp lá, hũ mật).
- 🐜 Bộ sưu tập 8 kiến đội trưởng với kỹ năng riêng (Nón Lá, Ninja, Béo, DJ, Phi Hành Gia, Hiệp Sĩ, Vua…).
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

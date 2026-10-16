const axios = require('axios');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '1qRORgbuVhvake0Ny3ek5dkKSxN0VKlTnBauiQOS5hzA';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Products`;

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        const row = {};
        headers.forEach((header, index) => {
            let val = currentLine[index] ? currentLine[index].replace(/^"|"$/g, '').trim() : '';
            row[header] = val;
        });
        result.push(row);
    }
    return result;
}

async function buildWebsite() {
    try {
        console.log('🔄 Đang tải dữ liệu từ Google Sheets...');
        const response = await axios.get(CSV_URL);
        const products = parseCSV(response.data);

        console.log(`✅ Đã tìm thấy ${products.length} sản phẩm.`);

        const distDir = path.join(__dirname, 'dist');
        if (!fs.existsSync(distDir)) {
            fs.mkdirSync(distDir);
        }

        const templatePath = path.join(__dirname, 'template.html');
        const templateHtml = fs.readFileSync(templatePath, 'utf8');

        let productCardsHtml = '';

        // 1. Vòng lặp tạo trang chi tiết cho từng sản phẩm và gom HTML danh sách trang chủ
        products.forEach(product => {
            if (product.status !== 'published') return;

            const fileName = `${product.slug || 'san-pham-' + product.id}.html`;

            // Tạo nội dung trang chi tiết
            let htmlContent = templateHtml
                .replaceAll('{{TITLE}}', product.title || '')
                .replaceAll('{{DESCRIPTION}}', product.description || '')
                .replaceAll('{{STAR}}', product.star || '3')
                .replaceAll('{{DISTRICT}}', product.district || '')
                .replaceAll('{{CATEGORY}}', product.category || '')
                .replaceAll('{{IMAGE_URL}}', product.image_url || '')
                .replaceAll('{{CONTENT}}', product.content || '')
                .replaceAll('{{AFFILIATE_LINK}}', product.affiliate_link || '#');

            fs.writeFileSync(path.join(distDir, fileName), htmlContent);
            console.log(` 📄 Đã tạo file: dist/${fileName}`);

            // Gom mã HTML cho từng thẻ sản phẩm hiển thị ngoài trang chủ
            productCardsHtml += `
                <div class="card">
                    <span class="badge">OCOP ${product.star || 3} SAO</span>
                    <img src="${product.image_url || ''}" alt="${product.title || ''}">
                    <h3>${product.title || ''}</h3>
                    <p><strong>${product.district || ''}</strong></p>
                    <p class="desc">${product.description || ''}</p>
                    <a href="${fileName}" class="btn-detail">Xem chi tiết</a>
                </div>
            `;
        });

        // 2. Tạo nội dung hoàn chỉnh cho trang chủ `index.html` đặt trong thư mục `dist`
        const indexHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sản Phẩm OCOP Quảng Ngãi - Đặc Sản Chính Gốc</title>
    <meta name="description" content="Danh mục tổng hợp các sản phẩm OCOP Quảng Ngãi đạt chuẩn 3 sao, 4 sao, 5 sao: Tỏi Lý Sơn, Mạch nha, Đường phèn...">
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f6f8; color: #333; }
        header { text-align: center; padding: 40px 20px; background: #00875a; color: white; }
        header h1 { margin: 0 0 10px 0; }
        .container { max-width: 1100px; margin: 30px auto; padding: 0 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between; position: relative; }
        .card img { width: 100%; height: 180px; object-fit: cover; border-radius: 6px; margin-bottom: 12px; }
        .badge { position: absolute; top: 30px; left: 30px; background: #ff9800; color: white; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .card h3 { margin: 10px 0 5px 0; font-size: 18px; }
        .card p { font-size: 14px; color: #666; margin: 5px 0; }
        .card .desc { font-size: 13px; color: #777; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .btn-detail { display: block; text-align: center; background: #00875a; color: white; padding: 10px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 15px; }
        .btn-detail:hover { background: #006c47; }
        footer { text-align: center; padding: 20px; color: #777; font-size: 14px; margin-top: 40px; }
    </style>
</head>
<body>

    <header>
        <h1>SẢN PHẨM OCOP QUẢNG NGÃI</h1>
        <p>Nền tảng kết nối và giới thiệu đặc sản chính gốc tỉnh Quảng Ngãi</p>
    </header>

    <main class="container">
        <h2>Tất cả sản phẩm nổi bật</h2>
        <div class="grid">
            ${productCardsHtml}
        </div>
    </main>

    <footer>
        <p>&copy; 2026 - Dự án Catalog OCOP Quảng Ngãi</p>
    </footer>

</body>
</html>`;

        fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml);
        console.log(' 📄 Đã tự động cập nhật trang chủ: dist/index.html');
        console.log('🎉 Hoàn thành xuất sắc! Toàn bộ website đã sẵn sàng.');

    } catch (error) {
        console.error('❌ Có lỗi xảy ra:', error.message);
    }
}

buildWebsite();
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
        const districtsSet = new Set();
        const categoriesSet = new Set();
        const producersSet = new Set();

        // 1. Tạo trang chi tiết & thu thập dữ liệu bộ lọc
        products.forEach(product => {
            if (product.status !== 'published') return;

            const star = product.star || '3';
            const district = product.district || 'Khác';
            const category = product.category || 'Khác';
            // Lấy thông tin đơn vị sản xuất từ mô tả/nội dung hoặc bổ sung fallback
            const producer = product.producer || (product.description && product.description.includes('Sản xuất bởi') ? product.description.split('Sản xuất bởi')[1].trim() : '');

            districtsSet.add(district);
            categoriesSet.add(category);
            if (producer) producersSet.add(producer);

            const fileName = `${product.slug || 'san-pham-' + product.id}.html`;

            // Tạo file chi tiết
            let htmlContent = templateHtml
                .replaceAll('{{TITLE}}', product.title || '')
                .replaceAll('{{DESCRIPTION}}', product.description || '')
                .replaceAll('{{STAR}}', star)
                .replaceAll('{{DISTRICT}}', district)
                .replaceAll('{{CATEGORY}}', category)
                .replaceAll('{{IMAGE_URL}}', product.image_url || '')
                .replaceAll('{{CONTENT}}', product.content || '')
                .replaceAll('{{AFFILIATE_LINK}}', product.affiliate_link || '#');

            fs.writeFileSync(path.join(distDir, fileName), htmlContent);

            // Thẻ sản phẩm gắn thêm thuộc tính data-producer-lower để phục vụ tìm kiếm chủ cơ sở
            productCardsHtml += `
                <div class="card" 
                     data-title="${(product.title || '').toLowerCase()}" 
                     data-star="${star}" 
                     data-district="${district}" 
                     data-district-lower="${district.toLowerCase()}"
                     data-category="${category}"
                     data-producer-lower="${producer.toLowerCase()}">
                    <span class="badge">OCOP ${star} SAO</span>
                    <img src="${product.image_url || ''}" alt="${product.title || ''}" loading="lazy">
                    <h3>${product.title || ''}</h3>
                    <p><strong>📍 ${district}</strong> | 🏷️ ${category}</p>
                    ${producer ? `<p class="producer-info">🏢 <em>${producer}</em></p>` : ''}
                    <p class="desc">${product.description || ''}</p>
                    <a href="${fileName}" class="btn-detail">Xem chi tiết</a>
                </div>
            `;
        });

        // Danh sách gợi ý datalist cho Xã và Đơn vị sản xuất
        let districtDatalistOptions = Array.from(districtsSet).sort().map(d => `<option value="${d}">`).join('');
        let producerDatalistOptions = Array.from(producersSet).sort().map(p => `<option value="${p}">`).join('');
        let categoryOptions = Array.from(categoriesSet).map(c => `<option value="${c}">${c}</option>`).join('');

        // 2. Giao diện trang chủ bổ sung Ô Tìm Kiếm Chủ Cơ Sở
        const indexHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sản Phẩm OCOP Quảng Ngãi - Tra Cứu 535 Đặc Sản Chính Gốc</title>
    <meta name="description" content="Danh mục tổng hợp 535 sản phẩm OCOP Quảng Ngãi đạt chuẩn 3 sao, 4 sao, 5 sao thuộc 96 xã phường thị trấn.">
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f6f8; color: #333; }
        header { text-align: center; padding: 40px 20px; background: #00875a; color: white; }
        header h1 { margin: 0 0 10px 0; }
        .container { max-width: 1200px; margin: 30px auto; padding: 0 20px; }
        
        /* Khung tìm kiếm & bộ lọc */
        .filter-section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            margin-bottom: 25px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .filter-section input, .filter-section select {
            padding: 12px;
            border: 1px solid #ccc;
            border-radius: 6px;
            font-size: 14px;
            width: 100%;
            box-sizing: border-box;
        }
        .filter-section input:focus, .filter-section select:focus {
            border-color: #00875a;
            outline: none;
        }
        .stats-count { font-size: 16px; font-weight: bold; margin-bottom: 20px; color: #00875a; }

        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between; position: relative; }
        .card img { width: 100%; height: 180px; object-fit: cover; border-radius: 6px; margin-bottom: 12px; }
        .badge { position: absolute; top: 30px; left: 30px; background: #ff9800; color: white; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .card h3 { margin: 10px 0 5px 0; font-size: 18px; }
        .card p { font-size: 13px; color: #666; margin: 4px 0; }
        .card .producer-info { font-size: 12px; color: #00875a; font-weight: 500; }
        .card .desc { font-size: 13px; color: #777; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .btn-detail { display: block; text-align: center; background: #00875a; color: white; padding: 10px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 15px; }
        .btn-detail:hover { background: #006c47; }
        footer { text-align: center; padding: 20px; color: #777; font-size: 14px; margin-top: 40px; }
    </style>
</head>
<body>

    <header>
        <h1>SẢN PHẨM OCOP QUẢNG NGÃI</h1>
        <p>Tra cứu 535 sản phẩm OCOP thuộc 96 Xã/Phường/Thị trấn</p>
    </header>

    <main class="container">
        <!-- Khung Tìm Kiếm Đa Chiều Nâng Cấp -->
        <div class="filter-section">
            <!-- 1. Tìm tên sản phẩm -->
            <input type="text" id="searchInput" placeholder="🔍 Tìm sản phẩm (vd: Tỏi, Mạch nha...)" onkeyup="filterProducts()">
            
            <!-- 2. Tìm tên Chủ cơ sở / Đơn vị sản xuất -->
            <input type="text" id="producerInput" list="producerList" placeholder="🏢 Tìm Chủ cơ sở / HTX / Công ty..." oninput="filterProducts()">
            <datalist id="producerList">
                ${producerDatalistOptions}
            </datalist>

            <!-- 3. Tìm tên Xã / Phường -->
            <input type="text" id="districtInput" list="districtList" placeholder="📍 Tìm Xã / Phường (vd: Lý Sơn, Măng Đen...)" oninput="filterProducts()">
            <datalist id="districtList">
                ${districtDatalistOptions}
            </datalist>

            <!-- 4. Lọc theo Sao -->
            <select id="starFilter" onchange="filterProducts()">
                <option value="">⭐ Tất cả Xếp Hạng Sao</option>
                <option value="5">OCOP 5 Sao</option>
                <option value="4">OCOP 4 Sao</option>
                <option value="3">OCOP 3 Sao</option>
            </select>

            <!-- 5. Lọc theo Nhóm ngành -->
            <select id="categoryFilter" onchange="filterProducts()">
                <option value="">🏷️ Tất cả Phân Loại</option>
                ${categoryOptions}
            </select>
        </div>

        <div class="stats-count" id="statsCount">Hiển thị ${products.length} / ${products.length} sản phẩm</div>

        <div class="grid" id="productGrid">
            ${productCardsHtml}
        </div>
    </main>

    <footer>
        <p>&copy; 2026 - Catalog OCOP Quảng Ngãi</p>
    </footer>

    <!-- Logic Tìm Kiếm Đa Chiều Tức Thời -->
    <script>
        function filterProducts() {
            const searchValue = document.getElementById('searchInput').value.toLowerCase().trim();
            const producerSearchValue = document.getElementById('producerInput').value.toLowerCase().trim();
            const districtSearchValue = document.getElementById('districtInput').value.toLowerCase().trim();
            const starValue = document.getElementById('starFilter').value;
            const categoryValue = document.getElementById('categoryFilter').value;

            const cards = document.querySelectorAll('#productGrid .card');
            let visibleCount = 0;

            cards.forEach(card => {
                const title = card.getAttribute('data-title') || '';
                const producerLower = card.getAttribute('data-producer-lower') || '';
                const districtLower = card.getAttribute('data-district-lower') || '';
                const star = card.getAttribute('data-star') || '';
                const category = card.getAttribute('data-category') || '';

                const matchesSearch = title.includes(searchValue);
                const matchesProducer = !producerSearchValue || producerLower.includes(producerSearchValue);
                const matchesDistrict = !districtSearchValue || districtLower.includes(districtSearchValue);
                const matchesStar = !starValue || star === starValue;
                const matchesCategory = !categoryValue || category === categoryValue;

                if (matchesSearch && matchesProducer && matchesDistrict && matchesStar && matchesCategory) {
                    card.style.display = 'flex';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });

            document.getElementById('statsCount').innerText = \`Hiển thị \${visibleCount} / \${cards.length} sản phẩm\`;
        }
    </script>

</body>
</html>`;

        fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml);
        console.log(' 📄 Đã cập nhật tính năng Tìm kiếm Chủ cơ sở sản xuất: dist/index.html');
        console.log('🎉 Hoàn thành xuất sắc!');

    } catch (error) {
        console.error('❌ Có lỗi xảy ra:', error.message);
    }
}

buildWebsite();
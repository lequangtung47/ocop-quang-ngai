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

function copyDirSync(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
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

        const imagesSrc = path.join(__dirname, 'images');
        const imagesDest = path.join(distDir, 'images');
        if (fs.existsSync(imagesSrc)) {
            copyDirSync(imagesSrc, imagesDest);
            console.log(' 🖼️ Đã sao chép thư mục ảnh sang dist/images');
        }

        const templatePath = path.join(__dirname, 'template.html');
        const templateHtml = fs.readFileSync(templatePath, 'utf8');

        // Phân loại sản phẩm theo Nhóm ngành hàng & Nổi bật
        const featuredProducts = [];
        const categoriesMap = {}; // { "Thực phẩm": [...], "Đồ uống": [...] }
        const districtsSet = new Set();
        const producersSet = new Set();

        products.forEach(product => {
            if (product.status !== 'published') return;

            const star = product.star || '3';
            const district = product.district || 'Khác';
            const category = product.category || 'Khác';
            const producer = product.producer || (product.description && product.description.includes('Sản xuất bởi') ? product.description.split('Sản xuất bởi')[1].trim() : '');
            const isFeatured = (product.featured || '').toString().toLowerCase() === 'true' || (product.featured || '').toString() === '1';

            districtsSet.add(district);
            if (producer) producersSet.add(producer);

            // Gom nhóm ngành hàng
            if (!categoriesMap[category]) {
                categoriesMap[category] = [];
            }

            const fileName = `${product.slug || 'san-pham-' + product.id}.html`;
            const imageUrl = product.image_url || 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500';

            const productData = {
                ...product,
                star,
                district,
                category,
                producer,
                fileName,
                imageUrl
            };

            categoriesMap[category].push(productData);

            if (isFeatured) {
                featuredProducts.push(productData);
            }

            // Tạo trang HTML chi tiết từng sản phẩm
            let htmlContent = templateHtml
                .replaceAll('{{TITLE}}', product.title || '')
                .replaceAll('{{DESCRIPTION}}', product.description || '')
                .replaceAll('{{STAR}}', star)
                .replaceAll('{{DISTRICT}}', district)
                .replaceAll('{{CATEGORY}}', category)
                .replaceAll('{{IMAGE_URL}}', imageUrl)
                .replaceAll('{{CONTENT}}', product.content || '')
                .replaceAll('{{AFFILIATE_LINK}}', product.affiliate_link || '#');

            fs.writeFileSync(path.join(distDir, fileName), htmlContent);
        });

        // Hàm hỗ trợ tạo thẻ HTML cho 1 sản phẩm
        function renderCard(p) {
            return `
                <div class="card" 
                     data-title="${(p.title || '').toLowerCase()}" 
                     data-star="${p.star}" 
                     data-district="${p.district}" 
                     data-district-lower="${p.district.toLowerCase()}"
                     data-category="${p.category}"
                     data-producer-lower="${(p.producer || '').toLowerCase()}">
                    <span class="badge">OCOP ${p.star} SAO</span>
                    <img src="${p.imageUrl}" alt="${p.title || ''}" loading="lazy">
                    <h3>${p.title || ''}</h3>
                    <p class="meta">📍 ${p.district} | 🏷️ ${p.category}</p>
                    ${p.producer ? `<p class="producer-info">🏢 <em>${p.producer}</em></p>` : ''}
                    <a href="${p.fileName}" class="btn-detail">Xem chi tiết</a>
                </div>
            `;
        }

        // 1. Tạo HTML cho Chuyên mục Nổi Bật (nếu có)
        let featuredSectionHtml = '';
        if (featuredProducts.length > 0) {
            const featuredCards = featuredProducts.map(p => renderCard(p)).join('');
            featuredSectionHtml = `
                <section class="category-section featured-section">
                    <div class="category-header">
                        <h2>🔥 SẢN PHẨM NỔI BẬT KHUYÊN DÙNG</h2>
                        <span class="count-tag">${featuredProducts.length} sản phẩm</span>
                    </div>
                    <div class="horizontal-scroll">
                        ${featuredCards}
                    </div>
                </section>
            `;
        }

        // 2. Tạo HTML cho các Chuyên mục Ngành hàng
        let categorySectionsHtml = '';
        for (const [catName, catProducts] of Object.entries(categoriesMap)) {
            const cardsHtml = catProducts.map(p => renderCard(p)).join('');
            categorySectionsHtml += `
                <section class="category-section">
                    <div class="category-header">
                        <h2>📦 CHUYÊN MỤC: ${catName.toUpperCase()}</h2>
                        <span class="count-tag">${catProducts.length} sản phẩm</span>
                    </div>
                    <div class="horizontal-scroll">
                        ${cardsHtml}
                    </div>
                </section>
            `;
        }

        let districtDatalistOptions = Array.from(districtsSet).sort().map(d => `<option value="${d}">`).join('');
        let producerDatalistOptions = Array.from(producersSet).sort().map(p => `<option value="${p}">`).join('');
        let categoryOptions = Object.keys(categoriesMap).map(c => `<option value="${c}">${c}</option>`).join('');

        // 3. Giao diện trang chủ hoàn chỉnh
        const indexHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sản Phẩm OCOP Quảng Ngãi - 535 Đặc Sản Chính Gốc</title>
    <meta name="description" content="Danh mục tổng hợp 535 sản phẩm OCOP Quảng Ngãi phân theo chuyên mục ngành hàng.">
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f6f8; color: #333; }
        header { text-align: center; padding: 35px 20px; background: #00875a; color: white; }
        header h1 { margin: 0 0 8px 0; font-size: 26px; }
        .container { max-width: 1250px; margin: 25px auto; padding: 0 15px; }
        
        /* Khung bộ lọc */
        .filter-section {
            background: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            margin-bottom: 25px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
        }
        .filter-section input, .filter-section select {
            padding: 10px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 13px;
            width: 100%;
            box-sizing: border-box;
        }
        .filter-section input:focus, .filter-section select:focus { border-color: #00875a; outline: none; }

        /* Chuyên mục & Cuộn ngang */
        .category-section { margin-bottom: 35px; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); }
        .featured-section { background: #fff8f0; border: 1px solid #ffe0b2; }
        .category-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #00875a; }
        .featured-section .category-header { border-bottom-color: #ff9800; }
        .category-header h2 { margin: 0; font-size: 18px; color: #00875a; }
        .featured-section .category-header h2 { color: #e65100; }
        .count-tag { background: #e8f5e9; color: #2e7d32; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; }

        /* Hàng ngang cuộn trái/phải */
        .horizontal-scroll {
            display: flex;
            gap: 15px;
            overflow-x: auto;
            padding-bottom: 10px;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
        }
        .horizontal-scroll::-webkit-scrollbar { height: 6px; }
        .horizontal-scroll::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
        .horizontal-scroll::-webkit-scrollbar-thumb:hover { background: #00875a; }

        /* Thẻ sản phẩm */
        .card {
            flex: 0 0 220px; /* Cố định chiều rộng thẻ trong hàng cuộn ngang */
            background: #fafafa;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #eee;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            box-sizing: border-box;
        }
        .card img { width: 100%; height: 140px; object-fit: cover; border-radius: 6px; margin-bottom: 8px; }
        .badge { position: absolute; top: 18px; left: 18px; background: #ff9800; color: white; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; }
        .card h3 { margin: 6px 0 4px 0; font-size: 15px; height: 38px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .card .meta { font-size: 11px; color: #666; margin: 3px 0; }
        .card .producer-info { font-size: 11px; color: #00875a; margin: 3px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .btn-detail { display: block; text-align: center; background: #00875a; color: white; padding: 8px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 12px; margin-top: 10px; }
        .btn-detail:hover { background: #006c47; }
        footer { text-align: center; padding: 20px; color: #777; font-size: 13px; margin-top: 30px; }
    </style>
</head>
<body>

    <header>
        <h1>SẢN PHẨM OCOP QUẢNG NGÃI</h1>
        <p>Catalog tra cứu 535 sản phẩm OCOP chính gốc phân theo chuyên mục</p>
    </header>

    <main class="container">
        <!-- Khung Tìm Kiếm & Bộ Lọc -->
        <div class="filter-section">
            <input type="text" id="searchInput" placeholder="🔍 Tìm tên sản phẩm..." onkeyup="filterProducts()">
            <input type="text" id="producerInput" list="producerList" placeholder="🏢 Tìm Chủ cơ sở / HTX..." oninput="filterProducts()">
            <datalist id="producerList">${producerDatalistOptions}</datalist>

            <input type="text" id="districtInput" list="districtList" placeholder="📍 Tìm Xã / Phường..." oninput="filterProducts()">
            <datalist id="districtList">${districtDatalistOptions}</datalist>

            <select id="starFilter" onchange="filterProducts()">
                <option value="">⭐ Tất cả Hạng Sao</option>
                <option value="5">OCOP 5 Sao</option>
                <option value="4">OCOP 4 Sao</option>
                <option value="3">OCOP 3 Sao</option>
            </select>

            <select id="categoryFilter" onchange="filterProducts()">
                <option value="">🏷️ Tất cả Chuyên Mục</option>
                ${categoryOptions}
            </select>
        </div>

        <!-- Các Chuyên Mục Ngành Hàng -->
        ${featuredSectionHtml}
        ${categorySectionsHtml}
    </main>

    <footer>
        <p>&copy; 2026 - Catalog OCOP Quảng Ngãi</p>
    </footer>

    <!-- Logic Lọc Tức Thời -->
    <script>
        function filterProducts() {
            const searchValue = document.getElementById('searchInput').value.toLowerCase().trim();
            const producerSearchValue = document.getElementById('producerInput').value.toLowerCase().trim();
            const districtSearchValue = document.getElementById('districtInput').value.toLowerCase().trim();
            const starValue = document.getElementById('starFilter').value;
            const categoryValue = document.getElementById('categoryFilter').value;

            const sections = document.querySelectorAll('.category-section');

            sections.forEach(section => {
                const cards = section.querySelectorAll('.card');
                let visibleCardsInSection = 0;

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
                        visibleCardsInSection++;
                    } else {
                        card.style.display = 'none';
                    }
                });

                // Nếu chuyên mục không có sản phẩm nào phù hợp thì ẩn luôn cả tiêu đề chuyên mục đó
                if (visibleCardsInSection > 0) {
                    section.style.display = 'block';
                } else {
                    section.style.display = 'none';
                }
            });
        }
    </script>

</body>
</html>`;

        fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml);
        console.log(' 📄 Đã cập nhật giao diện Chuyên mục & Cuộn ngang: dist/index.html');
        console.log('🎉 Hoàn thành xuất sắc!');

    } catch (error) {
        console.error('❌ Có lỗi xảy ra:', error.message);
    }
}

buildWebsite();
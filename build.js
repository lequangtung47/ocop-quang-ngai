const axios = require('axios');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '1qRORgbuVhvake0Ny3ek5dkKSxN0VKlTnBauiQOS5hzA';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Products`;

// LINK MẠNG XÃ HỘI CỦA BẠN
const FACEBOOK_URL = "https://facebook.com/ocopquangngai.official"; 
const TIKTOK_URL = "https://tiktok.com/@ocop.qung.ngi";            

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

        const featuredProducts = [];
        const categoriesMap = {};
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

        function renderCard(p) {
            return `
                <div class="card" 
                     data-title="${(p.title || '').toLowerCase()}" 
                     data-star="${p.star}" 
                     data-district="${p.district}" 
                     data-district-lower="${p.district.toLowerCase()}"
                     data-category="${p.category}"
                     data-producer-lower="${(p.producer || '').toLowerCase()}">
                    <span class="badge star-${p.star}">⭐ OCOP ${p.star} SAO</span>
                    <div class="img-wrapper">
                        <img src="${p.imageUrl}" alt="${p.title || ''}" loading="lazy">
                    </div>
                    <div class="card-body">
                        <h3>${p.title || ''}</h3>
                        <p class="meta">📍 ${p.district} • 🏷️ ${p.category}</p>
                        ${p.producer ? `<p class="producer-info">🏢 <em>${p.producer}</em></p>` : ''}
                    </div>
                    <a href="${p.fileName}" class="btn-detail">Xem chi tiết ➔</a>
                </div>
            `;
        }

        let featuredSectionHtml = '';
        if (featuredProducts.length > 0) {
            const featuredCards = featuredProducts.map(p => renderCard(p)).join('');
            featuredSectionHtml = `
                <section class="category-section featured-section">
                    <div class="category-header">
                        <h2>🔥 SẢN PHẨM NỔI BẬT</h2>
                        <span class="count-tag">${featuredProducts.length} sản phẩm</span>
                    </div>
                    <div class="scroll-container">
                        <button class="scroll-btn left" onclick="scrollSection(this, -300)">❮</button>
                        <div class="horizontal-scroll">
                            ${featuredCards}
                        </div>
                        <button class="scroll-btn right" onclick="scrollSection(this, 300)">❯</button>
                    </div>
                </section>
            `;
        }

        let categorySectionsHtml = '';
        for (const [catName, catProducts] of Object.entries(categoriesMap)) {
            const cardsHtml = catProducts.map(p => renderCard(p)).join('');
            categorySectionsHtml += `
                <section class="category-section">
                    <div class="category-header">
                        <h2>📦 CHUYÊN MỤC: ${catName.toUpperCase()}</h2>
                        <span class="count-tag">${catProducts.length} sản phẩm</span>
                    </div>
                    <div class="scroll-container">
                        <button class="scroll-btn left" onclick="scrollSection(this, -300)">❮</button>
                        <div class="horizontal-scroll">
                            ${cardsHtml}
                        </div>
                        <button class="scroll-btn right" onclick="scrollSection(this, 300)">❯</button>
                    </div>
                </section>
            `;
        }

        let districtDatalistOptions = Array.from(districtsSet).sort().map(d => `<option value="${d}">`).join('');
        let producerDatalistOptions = Array.from(producersSet).sort().map(p => `<option value="${p}">`).join('');
        let categoryOptions = Object.keys(categoriesMap).map(c => `<option value="${c}">${c}</option>`).join('');

        const fbSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`;
        const ttSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.82.57-1.33 1.55-1.34 2.55-.02.83.34 1.66.97 2.18.72.61 1.72.84 2.62.63.92-.2 1.74-.83 2.12-1.69.29-.62.43-1.32.42-2.02.02-5.18.01-10.37.01-15.55z"/></svg>`;

        const indexHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sản Phẩm OCOP Quảng Ngãi - 535 Đặc Sản Chính Gốc</title>
    <meta name="description" content="Danh mục tổng hợp 535 sản phẩm OCOP Quảng Ngãi thuộc 96 xã phường thị trấn.">
    <!-- Phông chữ Inter hiện đại -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #059669;
            --primary-dark: #047857;
            --primary-light: #ecfdf5;
            --accent: #f59e0b;
            --bg-body: #f8fafc;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --card-bg: #ffffff;
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.05);
            --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
            --shadow-lg: 0 10px 25px rgba(0,0,0,0.1);
        }

        * { box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background-color: var(--bg-body); color: var(--text-main); line-height: 1.5; }
        
        /* Header Banner Hiện Đại */
        header { 
            background: linear-gradient(135deg, #047857 0%, #10b981 100%); 
            color: white; 
            padding: 45px 20px 35px 20px; 
            text-align: center; 
            box-shadow: 0 4px 20px rgba(4, 120, 87, 0.25);
            position: relative;
        }
        header h1 { margin: 0 0 10px 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
        header p { margin: 0 0 18px 0; font-size: 15px; opacity: 0.92; font-weight: 400; }

        /* Cụm liên hệ MXH dạng Badge */
        .social-contact { display: inline-flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); padding: 6px 18px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.25); }
        .social-contact span { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; }
        .social-icons { display: inline-flex; gap: 10px; }
        .social-icon-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            text-decoration: none;
            transition: all 0.25s ease;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        .social-icon-btn:hover { transform: translateY(-3px) scale(1.08); box-shadow: 0 6px 15px rgba(0,0,0,0.3); }
        .icon-fb { background-color: #1877f2; }
        .icon-tt { background-color: #000000; }

        .container { max-width: 1280px; margin: 30px auto; padding: 0 20px; }
        
        /* Khung Lọc Sang Trọng */
        .filter-section {
            background: var(--card-bg);
            padding: 20px;
            border-radius: 16px;
            box-shadow: var(--shadow-md);
            margin-bottom: 30px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 14px;
            border: 1px solid #e2e8f0;
        }
        .filter-control { position: relative; }
        .filter-section input, .filter-section select {
            padding: 11px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            font-size: 13.5px;
            width: 100%;
            background-color: #f8fafc;
            color: var(--text-main);
            transition: all 0.2s ease;
            font-family: inherit;
        }
        .filter-section input:focus, .filter-section select:focus { 
            background-color: #fff;
            border-color: var(--primary); 
            outline: none; 
            box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15); 
        }

        /* Chuyên mục */
        .category-section { 
            margin-bottom: 35px; 
            background: var(--card-bg); 
            padding: 24px; 
            border-radius: 16px; 
            box-shadow: var(--shadow-sm); 
            border: 1px solid #e2e8f0; 
        }
        .featured-section { 
            background: #fffbeb; 
            border: 1.5px solid #fde68a; 
            box-shadow: 0 4px 15px rgba(245, 158, 11, 0.08);
        }
        .category-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #f1f5f9; }
        .featured-section .category-header { border-bottom-color: #fde68a; }
        .category-header h2 { margin: 0; font-size: 19px; font-weight: 700; color: var(--primary-dark); }
        .featured-section .category-header h2 { color: #d97706; }
        .count-tag { background: var(--primary-light); color: var(--primary-dark); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
        .featured-section .count-tag { background: #fef3c7; color: #b45309; }

        /* Cuộn Ngang Có Nút Bấm ❮ ❯ */
        .scroll-container { position: relative; display: flex; align-items: center; }
        .scroll-btn {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: white;
            border: 1px solid #cbd5e1;
            box-shadow: var(--shadow-md);
            cursor: pointer;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            color: var(--text-main);
            transition: all 0.2s ease;
        }
        .scroll-btn:hover { background: var(--primary); color: white; border-color: var(--primary); }
        .scroll-btn.left { left: -18px; }
        .scroll-btn.right { right: -18px; }

        .horizontal-scroll {
            display: flex;
            gap: 18px;
            overflow-x: auto;
            padding: 6px 4px 16px 4px;
            scroll-behavior: smooth;
            width: 100%;
            -webkit-overflow-scrolling: touch;
        }
        .horizontal-scroll::-webkit-scrollbar { height: 6px; }
        .horizontal-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .horizontal-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .horizontal-scroll::-webkit-scrollbar-thumb:hover { background: var(--primary); }

        /* Card Sản Phẩm UX/UI Chuẩn */
        .card {
            flex: 0 0 235px;
            background: var(--card-bg);
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            box-sizing: border-box;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
        }
        .card:hover { 
            transform: translateY(-5px); 
            box-shadow: var(--shadow-lg); 
            border-color: #cbd5e1;
        }
        
        .img-wrapper { width: 100%; height: 155px; overflow: hidden; position: relative; background: #f1f5f9; }
        .card img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
        .card:hover img { transform: scale(1.06); }

        /* Badge Hạng Sao */
        .badge { 
            position: absolute; 
            top: 10px; 
            left: 10px; 
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
            color: white; 
            padding: 4px 9px; 
            border-radius: 6px; 
            font-size: 10.5px; 
            font-weight: 700; 
            box-shadow: 0 2px 6px rgba(0,0,0,0.18);
            z-index: 2;
        }

        .card-body { padding: 12px 14px 4px 14px; flex-grow: 1; }
        .card h3 { 
            margin: 0 0 6px 0; 
            font-size: 14.5px; 
            font-weight: 600;
            line-height: 1.35;
            height: 39px; 
            overflow: hidden; 
            display: -webkit-box; 
            -webkit-line-clamp: 2; 
            -webkit-box-orient: vertical; 
            color: var(--text-main);
        }
        .card .meta { font-size: 11.5px; color: var(--text-muted); margin: 4px 0; font-weight: 500; }
        .card .producer-info { font-size: 11.5px; color: var(--primary-dark); margin: 4px 0 8px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }

        .btn-detail { 
            display: block; 
            text-align: center; 
            background: var(--primary-light); 
            color: var(--primary-dark); 
            padding: 9px 12px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: 700; 
            font-size: 12.5px; 
            margin: 10px 14px 14px 14px; 
            transition: all 0.2s ease;
        }
        .card:hover .btn-detail { background: var(--primary); color: white; }

        footer { text-align: center; padding: 30px; color: var(--text-muted); font-size: 13.5px; margin-top: 40px; background: white; border-top: 1px solid #e2e8f0; }

        @media (max-width: 768px) {
            .scroll-btn { display: none; } /* Ẩn nút mũi tên trên di động, ưu tiên vuốt cảm ứng */
            header h1 { font-size: 22px; }
            .container { padding: 0 12px; }
        }
    </style>
</head>
<body>

    <header>
        <h1>SẢN PHẨM OCOP QUẢNG NGÃI</h1>
        <p>Tra cứu 535 sản phẩm OCOP thuộc 96 Xã/Phường/Thị trấn</p>
        
        <div class="social-contact">
            <span>Liên hệ:</span>
            <div class="social-icons">
                <a href="${FACEBOOK_URL}" target="_blank" class="social-icon-btn icon-fb" title="Theo dõi Facebook">
                    ${fbSvg}
                </a>
                <a href="${TIKTOK_URL}" target="_blank" class="social-icon-btn icon-tt" title="Theo dõi TikTok">
                    ${ttSvg}
                </a>
            </div>
        </div>
    </header>

    <main class="container">
        <!-- Khung Tìm Kiếm & Bộ Lọc Nâng Cấp -->
        <div class="filter-section">
            <div class="filter-control">
                <input type="text" id="searchInput" placeholder="🔍 Tìm tên sản phẩm..." onkeyup="filterProducts()">
            </div>
            <div class="filter-control">
                <input type="text" id="producerInput" list="producerList" placeholder="🏢 Tìm Chủ cơ sở / HTX..." oninput="filterProducts()">
                <datalist id="producerList">${producerDatalistOptions}</datalist>
            </div>
            <div class="filter-control">
                <input type="text" id="districtInput" list="districtList" placeholder="📍 Tìm Xã / Phường..." oninput="filterProducts()">
                <datalist id="districtList">${districtDatalistOptions}</datalist>
            </div>
            <div class="filter-control">
                <select id="starFilter" onchange="filterProducts()">
                    <option value="">⭐ Tất cả Hạng Sao</option>
                    <option value="5">OCOP 5 Sao</option>
                    <option value="4">OCOP 4 Sao</option>
                    <option value="3">OCOP 3 Sao</option>
                </select>
            </div>
            <div class="filter-control">
                <select id="categoryFilter" onchange="filterProducts()">
                    <option value="">🏷️ Tất cả Chuyên Mục</option>
                    ${categoryOptions}
                </select>
            </div>
        </div>

        <!-- Danh mục sản phẩm -->
        ${featuredSectionHtml}
        ${categorySectionsHtml}
    </main>

    <footer>
        <p>&copy; 2026 - Catalog OCOP Quảng Ngãi</p>
        <div class="social-contact" style="margin-top: 10px;">
            <span>Liên hệ:</span>
            <div class="social-icons">
                <a href="${FACEBOOK_URL}" target="_blank" class="social-icon-btn icon-fb" title="Facebook">
                    ${fbSvg}
                </a>
                <a href="${TIKTOK_URL}" target="_blank" class="social-icon-btn icon-tt" title="TikTok">
                    ${ttSvg}
                </a>
            </div>
        </div>
    </footer>

    <script>
        // Xử lý cuộn bằng nút mũi tên ❮ ❯
        function scrollSection(btn, distance) {
            const scrollContainer = btn.parentElement.querySelector('.horizontal-scroll');
            if (scrollContainer) {
                scrollContainer.scrollBy({ left: distance, behavior: 'smooth' });
            }
        }

        // Logic Lọc Tức Thời
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
        console.log(' 📄 Đã nâng cấp giao diện UI/UX hoàn hảo: dist/index.html');
        console.log('🎉 Hoàn thành xuất sắc!');

    } catch (error) {
        console.error('❌ Có lỗi xảy ra:', error.message);
    }
}

buildWebsite();
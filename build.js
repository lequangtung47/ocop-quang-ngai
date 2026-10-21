const axios = require('axios');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '1qRORgbuVhvake0Ny3ek5dkKSxN0VKlTnBauiQOS5hzA';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Products`;

const DOMAIN = 'https://ocopquangngai.com.vn';
const FACEBOOK_URL = "https://facebook.com/ocopquangngai.official"; 
const TIKTOK_URL = "https://tiktok.com/@ocop.qung.ngi";            

const MAX_DISPLAY_PER_CATEGORY = 24;

// Hàm đọc CSV thông minh: Xử lý triệt để việc xuống dòng (Ctrl + Enter) bên trong 1 ô của Google Sheets
function parseCSV(csvText) {
    const rows = [];
    let row = [];
    let inQuotes = false;
    let currentValue = '';
    
    for (let i = 0; i < csvText.length; i++) {
        let c = csvText[i];
        let nextC = csvText[i+1];
        
        if (inQuotes) {
            if (c === '"') {
                if (nextC === '"') {
                    currentValue += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                currentValue += c;
            }
        } else {
            if (c === '"') {
                inQuotes = true;
            } else if (c === ',') {
                row.push(currentValue);
                currentValue = '';
            } else if (c === '\r') {
                // Bỏ qua ký tự xuống dòng kiểu Windows
            } else if (c === '\n') {
                row.push(currentValue);
                rows.push(row);
                row = [];
                currentValue = '';
            } else {
                currentValue += c;
            }
        }
    }
    if (currentValue || row.length > 0) {
        row.push(currentValue);
        rows.push(row);
    }
    
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.replace(/^"|"$/g, '').trim());
    const result = [];
    
    for (let i = 1; i < rows.length; i++) {
        const rFields = rows[i];
        if (rFields.length === 1 && rFields[0].trim() === '') continue;
        const rowObj = {};
        headers.forEach((header, index) => {
            let val = rFields[index] !== undefined ? rFields[index] : '';
            val = val.replace(/^"|"$/g, '').trim();
            rowObj[header] = val;
        });
        result.push(rowObj);
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

        const sitemapUrls = [`${DOMAIN}/`];

        products.forEach(product => {
            if (product.status !== 'published') return;

            const star = product.star || '3';
            const district = product.district || 'Khác';
            const category = product.category || 'Khác';
            const producer = product.producer || (product.description && product.description.includes('Sản xuất bởi') ? product.description.split('Sản xuất bởi')[1].trim() : '');
            const isFeatured = (product.featured || '').toString().toLowerCase() === 'true' || (product.featured || '').toString() === '1';
            
            const sortOrder = parseInt(product.sort_order || product.order || '9999', 10);

            districtsSet.add(district);
            if (producer) producersSet.add(producer);

            if (!categoriesMap[category]) {
                categoriesMap[category] = [];
            }

            const fileName = `${product.slug || 'san-pham-' + product.id}.html`;
            const rawImageUrl = (product.image_url || '').trim();
            const absoluteImageUrl = rawImageUrl.startsWith('http') ? rawImageUrl : `${DOMAIN}/${rawImageUrl}`;

            sitemapUrls.push(`${DOMAIN}/${fileName}`);

            const productData = {
                ...product,
                star,
                district,
                category,
                producer,
                sortOrder: isNaN(sortOrder) ? 9999 : sortOrder,
                fileName,
                imageUrl: rawImageUrl
            };

            categoriesMap[category].push(productData);

            if (isFeatured) {
                featuredProducts.push(productData);
            }

            let detailImageHtml = '';
            if (rawImageUrl !== '') {
                detailImageHtml = `
                    <div class="detail-img-container">
                        <img src="${rawImageUrl}" alt="${product.title || ''}" loading="lazy">
                    </div>
                `;
            }

            let htmlContent = templateHtml
                .replaceAll('{{TITLE}}', product.title || '')
                .replaceAll('{{DESCRIPTION}}', product.description || `Sản phẩm OCOP ${star} sao tại ${district}, Quảng Ngãi. Tra cứu/tìm mua sản phẩm OCOP Quảng Ngãi thuộc 96 xã phường đặc khu.`)
                .replaceAll('{{STAR}}', star)
                .replaceAll('{{DISTRICT}}', district)
                .replaceAll('{{CATEGORY}}', category)
                .replaceAll('{{IMAGE_HTML}}', detailImageHtml)
                .replaceAll('{{CONTENT}}', product.content || '')
                .replaceAll('{{AFFILIATE_LINK}}', product.affiliate_link || '#')
                .replaceAll('{{FILE_NAME}}', fileName)
                .replaceAll('{{OG_IMAGE}}', rawImageUrl !== '' ? absoluteImageUrl : `${DOMAIN}/images/default-share.jpg`);

            fs.writeFileSync(path.join(distDir, fileName), htmlContent);
        });

        const sortByOrder = (a, b) => a.sortOrder - b.sortOrder;

        function renderCard(p, isHidden = false) {
            const imgHtml = p.imageUrl !== '' 
                ? `<div class="img-wrapper"><img src="${p.imageUrl}" alt="${p.title || ''}" loading="lazy"></div>` 
                : '';

            return `
                <div class="card ${isHidden ? 'extra-card' : ''}" 
                     style="${isHidden ? 'display: none;' : ''}"
                     data-title="${(p.title || '').toLowerCase()}" 
                     data-star="${p.star}" 
                     data-district="${p.district}" 
                     data-district-lower="${p.district.toLowerCase()}"
                     data-category="${p.category}"
                     data-producer-lower="${(p.producer || '').toLowerCase()}">
                    <div class="card-top-bar">
                        <span class="badge star-${p.star}">⭐ OCOP ${p.star} SAO</span>
                    </div>
                    ${imgHtml}
                    <div class="card-body">
                        <h3>${p.title || ''}</h3>
                        <p class="meta">📍 ${p.district} • 🏷️ ${p.category}</p>
                        ${p.producer ? `<p class="producer-info">🏢 <em>${p.producer}</em></p>` : ''}
                    </div>
                    <a href="${p.fileName}" class="btn-detail">Xem chi tiết ➔</a>
                </div>
            `;
        }

        featuredProducts.sort(sortByOrder);

        let featuredSectionHtml = '';
        if (featuredProducts.length > 0) {
            const featuredCards = featuredProducts.map((p, idx) => renderCard(p, idx >= MAX_DISPLAY_PER_CATEGORY)).join('');
            featuredSectionHtml = `
                <section class="category-section featured-section" id="cat-featured">
                    <div class="category-header">
                        <h2>🔥 SẢN PHẨM NỔI BẬT / QUÀ TẶNG</h2>
                        <div class="header-actions">
                            <span class="count-tag">${featuredProducts.length} sản phẩm</span>
                            ${featuredProducts.length > MAX_DISPLAY_PER_CATEGORY ? `<button class="btn-expand-cat" onclick="expandCategory('cat-featured', this)">Xem tất cả (${featuredProducts.length}) ➔</button>` : ''}
                        </div>
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
        let catIndex = 0;
        for (const [catName, catProducts] of Object.entries(categoriesMap)) {
            catIndex++;
            const catId = `cat-sec-${catIndex}`;
            catProducts.sort(sortByOrder);

            const cardsHtml = catProducts.map((p, idx) => renderCard(p, idx >= MAX_DISPLAY_PER_CATEGORY)).join('');
            const hasMore = catProducts.length > MAX_DISPLAY_PER_CATEGORY;

            categorySectionsHtml += `
                <section class="category-section" id="${catId}">
                    <div class="category-header">
                        <h2>📦 CHUYÊN MỤC: ${catName.toUpperCase()}</h2>
                        <div class="header-actions">
                            <span class="count-tag">${catProducts.length} sản phẩm</span>
                            ${hasMore ? `<button class="btn-expand-cat" onclick="expandCategory('${catId}', this)">Xem tất cả (${catProducts.length}) ➔</button>` : ''}
                        </div>
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

        const fbSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`;
        const ttSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.82.57-1.33 1.55-1.34 2.55-.02.83.34 1.66.97 2.18.72.61 1.72.84 2.62.63.92-.2 1.74-.83 2.12-1.69.29-.62.43-1.32.42-2.02.02-5.18.01-10.37.01-15.55z"/></svg>`;

        const indexHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sản Phẩm OCOP Quảng Ngãi - Đặc Sản Chính Gốc</title>
    <meta name="description" content="Tra cứu/tìm mua sản phẩm OCOP Quảng Ngãi thuộc 96 xã phường đặc khu.">
    <meta name="keywords" content="OCOP Quảng Ngãi, đặc sản Quảng Ngãi, nông sản Quảng Ngãi, catalog OCOP, tỏi Lý Sơn, nấm linh chi">
    <meta name="robots" content="index, follow">

    <meta property="og:type" content="website">
    <meta property="og:title" content="Sản Phẩm OCOP Quảng Ngãi - Đặc Sản Chính Gốc">
    <meta property="og:description" content="Tra cứu/tìm mua sản phẩm OCOP Quảng Ngãi thuộc 96 xã phường đặc khu.">
    <meta property="og:url" content="${DOMAIN}">

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
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background-color: var(--bg-body); color: var(--text-main); line-height: 1.6; }
        
        header { 
            background: linear-gradient(135deg, #047857 0%, #10b981 100%); 
            color: white; 
            padding: 40px 20px 30px 20px; 
            text-align: center; 
            box-shadow: 0 4px 20px rgba(4, 120, 87, 0.25);
        }
        header h1 { margin: 0 0 8px 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
        header p { margin: 0 0 15px 0; font-size: 14.5px; opacity: 0.92; font-weight: 400; }

        .social-contact { display: inline-flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); padding: 5px 16px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.25); }
        .social-contact span { font-size: 12.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; }
        .social-icons { display: inline-flex; gap: 8px; }
        .social-icon-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            text-decoration: none;
            transition: all 0.25s ease;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        .social-icon-btn:hover { transform: translateY(-2px) scale(1.08); }
        .icon-fb { background-color: #1877f2; }
        .icon-tt { background-color: #000000; }

        .container { max-width: 1280px; margin: 25px auto; padding: 0 20px; }
        
        .intro-banner {
            background: var(--card-bg);
            border-left: 5px solid var(--primary);
            padding: 14px 20px;
            border-radius: 12px;
            box-shadow: var(--shadow-sm);
            margin-bottom: 20px;
            font-size: 14px;
            color: #334155;
            line-height: 1.6;
            border-top: 1px solid #e2e8f0;
            border-right: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
        }

        .intro-content {
            overflow: hidden;
            display: -webkit-box;
            line-clamp: 1;
            -webkit-line-clamp: 1;
            -webkit-box-orient: vertical;
            transition: all 0.3s ease;
        }

        .intro-content.expanded { display: block; }

        .btn-toggle-intro {
            background: none;
            border: none;
            color: var(--primary);
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
            padding: 4px 0 0 0;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-family: inherit;
        }
        .btn-toggle-intro:hover { text-decoration: underline; color: var(--primary-dark); }

        .filter-section {
            background: var(--card-bg);
            padding: 14px 18px;
            border-radius: 12px;
            box-shadow: var(--shadow-sm);
            margin-bottom: 25px;
            border: 1px solid #e2e8f0;
            border-left: 5px solid var(--primary);
        }
        
        .filter-basic {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .filter-basic .filter-control {
            flex-grow: 1;
        }

        .filter-advanced {
            display: none;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 10px;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px dashed #e2e8f0;
        }

        .filter-advanced.show-filter {
            display: grid !important;
        }

        .btn-toggle-filter {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            color: var(--primary-dark);
            font-weight: 700;
            font-size: 13px;
            padding: 10px 14px;
            border-radius: 10px;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s ease;
            font-family: inherit;
            height: 42px;
        }
        .btn-toggle-filter:hover {
            background: var(--primary-light);
            border-color: var(--primary);
        }

        .filter-control input, .filter-control select {
            padding: 10px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            font-size: 13.5px;
            width: 100%;
            height: 42px;
            background-color: #f8fafc;
            color: var(--text-main);
            transition: all 0.2s ease;
            font-family: inherit;
        }
        .filter-control input:focus, .filter-control select:focus { 
            background-color: #fff;
            border-color: var(--primary); 
            outline: none; 
            box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15); 
        }

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
        .category-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #f1f5f9; }
        .featured-section .category-header { border-bottom-color: #fde68a; }
        .category-header h2 { margin: 0; font-size: 19px; font-weight: 700; color: var(--primary-dark); }
        .featured-section .category-header h2 { color: #d97706; }
        
        .header-actions { display: flex; align-items: center; gap: 10px; }
        .count-tag { background: var(--primary-light); color: var(--primary-dark); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
        .featured-section .count-tag { background: #fef3c7; color: #b45309; }

        .btn-expand-cat {
            background: white;
            border: 1px solid var(--primary);
            color: var(--primary-dark);
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: inherit;
        }
        .btn-expand-cat:hover { background: var(--primary); color: white; }

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
        
        .card-top-bar { padding: 10px 12px 0 12px; }
        .badge { 
            display: inline-block;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
            color: white; 
            padding: 4px 9px; 
            border-radius: 6px; 
            font-size: 10.5px; 
            font-weight: 700; 
            box-shadow: 0 2px 6px rgba(0,0,0,0.18);
        }

        .img-wrapper { width: 100%; height: 145px; overflow: hidden; position: relative; background: #f1f5f9; margin-top: 8px; }
        .card img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
        .card:hover img { transform: scale(1.06); }

        .card-body { padding: 10px 14px 4px 14px; flex-grow: 1; }
        .card h3 { 
            margin: 0 0 6px 0; 
            font-size: 14.5px; 
            font-weight: 600;
            line-height: 1.35;
            height: 39px; 
            overflow: hidden; 
            display: -webkit-box; 
            line-clamp: 2;
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
            .scroll-btn { display: none; }
            header h1 { font-size: 22px; }
            .container { padding: 0 12px; }
            .intro-banner { font-size: 13px; padding: 12px 15px; }
        }
    </style>
</head>
<body>

    <header>
        <h1>TRANG TIN SẢN PHẨM OCOP QUẢNG NGÃI</h1>
        <p>Tra cứu/tìm mua sản phẩm OCOP Quảng Ngãi thuộc 96 xã phường đặc khu.</p>
        
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
        <div class="intro-banner">
            <div class="intro-content" id="introText">
                Chương trình "Mỗi xã một sản phẩm" (OCOP) là động lực phát triển kinh tế nông thôn bằng việc chuẩn hóa các sản phẩm đặc trưng mang đậm bản sắc văn hóa vùng miền; trong đó, Quảng Ngãi với tiềm năng phong phú từ đồng bằng ven sông Trà Khúc, khối núi Ngọc Linh hùng vĩ đến biển đảo Lý Sơn chính là vùng đất hội tụ nhiều sản phẩm đặc hữu trứ danh. Phát huy lợi thế này, kho tàng OCOP Quảng Ngãi với hàng trăm sản phẩm đạt chuẩn từ 3 đến 5 sao từ 96 xã, phường, thị trấn không chỉ là kết tinh tâm huyết và văn hóa địa phương mà còn là cầu nối uy tín đưa nông sản chất lượng cao vươn xa, góp phần thúc đẩy kinh tế tỉnh nhà phát triển bền vững.
            </div>
            <button class="btn-toggle-intro" id="btnToggleIntro" onclick="toggleIntro()">Xem thêm ▾</button>
        </div>

        <div class="filter-section">
            <div class="filter-basic">
                <div class="filter-control">
                    <input type="text" id="searchInput" placeholder="🔍 Tìm tên sản phẩm..." onkeyup="filterProducts()">
                </div>
                <button type="button" class="btn-toggle-filter" id="btnToggleFilter" onclick="toggleFilterAction()">Bộ lọc ▾</button>
            </div>

            <div class="filter-advanced" id="filterAdvanced">
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
        </div>

        ${featuredSectionHtml}
        ${categorySectionsHtml}
    </main>

    <footer>
        <p>&copy; 2026 - Trang tin tổng hợp về sản phẩm OCOP Quảng Ngãi</p>
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
        function toggleIntro() {
            const introText = document.getElementById('introText');
            const btn = document.getElementById('btnToggleIntro');
            if (introText.classList.contains('expanded')) {
                introText.classList.remove('expanded');
                btn.innerHTML = 'Xem thêm ▾';
            } else {
                introText.classList.add('expanded');
                btn.innerHTML = 'Thu gọn ▴';
            }
        }

        function toggleFilterAction() {
            const filterAdv = document.getElementById('filterAdvanced');
            const btn = document.getElementById('btnToggleFilter');
            if (filterAdv.classList.contains('show-filter')) {
                filterAdv.classList.remove('show-filter');
                btn.innerHTML = 'Bộ lọc ▾';
            } else {
                filterAdv.classList.add('show-filter');
                btn.innerHTML = 'Thu gọn ▴';
            }
        }

        function expandCategory(sectionId, btn) {
            const section = document.getElementById(sectionId);
            if (!section) return;
            const extraCards = section.querySelectorAll('.extra-card');
            const isExpanded = btn.getAttribute('data-expanded') === 'true';

            if (isExpanded) {
                extraCards.forEach(c => c.style.display = 'none');
                btn.setAttribute('data-expanded', 'false');
                btn.innerText = btn.getAttribute('data-original-text');
            } else {
                if (!btn.getAttribute('data-original-text')) {
                    btn.setAttribute('data-original-text', btn.innerText);
                }
                extraCards.forEach(c => c.style.display = 'flex');
                btn.setAttribute('data-expanded', 'true');
                btn.innerText = 'Thu gọn ▴';
            }
        }

        function scrollSection(btn, distance) {
            const scrollContainer = btn.parentElement.querySelector('.horizontal-scroll');
            if (scrollContainer) {
                scrollContainer.scrollBy({ left: distance, behavior: 'smooth' });
            }
        }

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
        fs.writeFileSync(path.join(__dirname, 'index.html'), indexHtml);

        let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
        sitemapUrls.forEach(url => {
            sitemapXml += `  <url>\n    <loc>${url}</loc>\n    <changefreq>daily</changefreq>\n    <priority>${url === DOMAIN + '/' ? '1.0' : '0.8'}</priority>\n  </url>\n`;
        });
        sitemapXml += `</urlset>`;
        fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml);

        const robotsTxt = `User-agent: *\nAllow: /\n\nSitemap: ${DOMAIN}/sitemap.xml`;
        fs.writeFileSync(path.join(distDir, 'robots.txt'), robotsTxt);

        console.log(' 🗺️ Đã phân tích đúng định dạng xuống dòng và hình ảnh từ Google Sheets!');
        console.log(' 📄 Đã build xong toàn bộ website hoàn hảo!');

    } catch (error) {
        console.error('❌ Có lỗi xảy ra:', error.message);
    }
}

buildWebsite();
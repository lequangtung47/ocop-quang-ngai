const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const SPREADSHEET_ID = '1qRORgbuVhvake0Ny3ek5dkKSxN0VKlTnBauiQOS5hzA';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Products`;

const DOMAIN = 'https://ocopquangngai.com.vn';
const FACEBOOK_URL = "https://facebook.com/ocopquangngai.official"; 
const TIKTOK_URL = "https://tiktok.com/@ocop.qung.ngi";            

const MAX_DISPLAY_PER_CATEGORY = 24;

function normalizeHeader(h) {
    if (!h) return '';
    const norm = h.toString().toLowerCase().trim()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[\s_-]+/g, '');
    
    if (norm.includes('status') || norm.includes('trangthai')) return 'status';
    if (norm.includes('featured') || norm.includes('noibat') || norm.includes('uutien')) return 'featured';
    if (norm.includes('image') || norm.includes('img') || norm.includes('hinhanh') || norm.includes('anh')) return 'image_url';
    if (norm.includes('affiliate') || norm.includes('shopee') || norm.includes('link')) return 'affiliate_link';
    if (norm.includes('star') || norm.includes('sao')) return 'star';
    if (norm.includes('district') || norm.includes('xa') || norm.includes('huyen') || norm.includes('khuvuc')) return 'district';
    if (norm.includes('category') || norm.includes('chuyenmuc') || norm.includes('danhmuc')) return 'category';
    if (norm.includes('title') || norm.includes('tensanpham') || norm.includes('ten')) return 'title';
    if (norm.includes('slug') || norm.includes('duongdan')) return 'slug';
    if (norm.includes('sort') || norm.includes('order') || norm.includes('thutu')) return 'sort_order';
    if (norm.includes('description') || norm.includes('motangan')) return 'description';
    if (norm.includes('content') || norm.includes('noidung') || norm.includes('mota')) return 'content';
    return norm;
}

function parseCSV(csvText) {
    try {
        const records = parse(csvText, {
            columns: false,
            skip_empty_lines: true,
            trim: true,
            relax_quotes: true,
            relax_column_count: true
        });
        
        if (records.length < 2) return [];

        const rawHeaders = records[0];
        const headerMap = rawHeaders.map(h => normalizeHeader(h));
        
        const result = [];
        for (let i = 1; i < records.length; i++) {
            const row = records[i];
            const obj = {};
            headerMap.forEach((key, index) => {
                let val = row[index] !== undefined ? row[index] : '';
                obj[key] = val.toString().trim();
            });
            result.push(obj);
        }
        return result;
    } catch (err) {
        console.error('❌ Lỗi đọc CSV:', err.message);
        return [];
    }
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

        console.log(`✅ Đã đọc thành công ${products.length} sản phẩm.`);

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
            const status = (product.status || '').toLowerCase();
            if (status !== 'published') return;

            const star = product.star || '3';
            const district = product.district || 'Khác';
            const category = product.category || 'Khác';
            const producer = product.producer || (product.description && product.description.includes('Sản xuất bởi') ? product.description.split('Sản xuất bởi')[1].trim() : '');
            
            const featuredRaw = (product.featured || '').toLowerCase();
            const isFeatured = featuredRaw === 'true' || featuredRaw === '1' || featuredRaw === 'x' || featuredRaw === 'yes';

            const sortOrder = parseInt(product.sort_order || '9999', 10);

            districtsSet.add(district);
            if (producer) producersSet.add(producer);

            if (!categoriesMap[category]) {
                categoriesMap[category] = [];
            }

            const fileName = `${product.slug || 'san-pham-' + Math.random()}.html`;
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
                : `<div class="img-wrapper no-img"><span>🌾 OCOP</span></div>`;

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
                        <span class="badge star-${p.star}">⭐ ${p.star} SAO</span>
                    </div>
                    ${imgHtml}
                    <div class="card-body">
                        <h3>${p.title || ''}</h3>
                        <p class="meta">📍 ${p.district}</p>
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
                        <div class="cat-title-group">
                            <h2>🔥 SẢN PHẨM NỔI BẬT</h2>
                            <span class="count-tag">${featuredProducts.length} sản phẩm</span>
                        </div>
                        ${featuredProducts.length > MAX_DISPLAY_PER_CATEGORY ? `<button class="btn-expand-cat" onclick="expandCategory('cat-featured', this)">Xem tất cả (${featuredProducts.length}) ➔</button>` : ''}
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
                        <div class="cat-title-group">
                            <h2>📦 ${catName.toUpperCase()}</h2>
                            <span class="count-tag">${catProducts.length} sản phẩm</span>
                        </div>
                        ${hasMore ? `<button class="btn-expand-cat" onclick="expandCategory('${catId}', this)">Xem tất cả (${catProducts.length}) ➔</button>` : ''}
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

        const fbSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`;
        const ttSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.82.57-1.33 1.55-1.34 2.55-.02.83.34 1.66.97 2.18.72.61 1.72.84 2.62.63.92-.2 1.74-.83 2.12-1.69.29-.62.43-1.32.42-2.02.02-5.18.01-10.37.01-15.55z"/></svg>`;

        const indexHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Sản Phẩm OCOP Quảng Ngãi - Catalog Đặc Sản Chính Gốc</title>
    <meta name="description" content="Tra cứu và tìm mua sản phẩm OCOP Quảng Ngãi đạt chuẩn 3-5 sao thuộc 96 xã phường.">
    <meta name="keywords" content="OCOP Quảng Ngãi, đặc sản Quảng Ngãi, nông sản Quảng Ngãi, catalog OCOP, tỏi Lý Sơn, nấm linh chi">
    <meta name="robots" content="index, follow">

    <meta property="og:type" content="website">
    <meta property="og:title" content="Sản Phẩm OCOP Quảng Ngãi - Catalog Đặc Sản Chính Gốc">
    <meta property="og:description" content="Tra cứu và tìm mua sản phẩm OCOP Quảng Ngãi đạt chuẩn 3-5 sao.">
    <meta property="og:url" content="${DOMAIN}">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --primary: #059669;
            --primary-dark: #047857;
            --primary-gradient: linear-gradient(135deg, #059669 0%, #0284c7 100%);
            --accent: #f59e0b;
            --bg-body: #f1f5f9;
            --text-main: #0f172a;
            --text-muted: #64748b;
            --card-bg: #ffffff;
            --shadow-sm: 0 2px 8px rgba(15, 23, 42, 0.04);
            --shadow-md: 0 8px 20px rgba(15, 23, 42, 0.08);
            --shadow-lg: 0 12px 30px rgba(15, 23, 42, 0.12);
        }

        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background-color: var(--bg-body); color: var(--text-main); line-height: 1.5; }
        
        header { 
            background: var(--primary-gradient); 
            color: white; 
            padding: 24px 16px 20px 16px; 
            text-align: center; 
            border-radius: 0 0 24px 24px;
            box-shadow: 0 10px 25px rgba(5, 150, 105, 0.2);
        }
        header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.3px; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        header p { margin: 0 0 14px 0; font-size: 13px; opacity: 0.95; font-weight: 500; max-width: 600px; margin-left: auto; margin-right: auto; }

        .social-contact { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.18); backdrop-filter: blur(10px); padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.3); }
        .social-contact span { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; }
        .social-icons { display: inline-flex; gap: 6px; }
        .social-icon-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            text-decoration: none;
            transition: transform 0.2s ease;
        }
        .social-icon-btn:active { transform: scale(0.9); }
        .icon-fb { background-color: #1877f2; }
        .icon-tt { background-color: #000000; }

        .container { max-width: 1280px; margin: 16px auto; padding: 0 12px; }
        
        .intro-banner {
            background: var(--card-bg);
            padding: 12px 16px;
            border-radius: 16px;
            box-shadow: var(--shadow-sm);
            margin-bottom: 14px;
            font-size: 13px;
            color: #334155;
            border: 1px solid #e2e8f0;
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
            font-size: 12px;
            cursor: pointer;
            padding: 4px 0 0 0;
            display: inline-flex;
            align-items: center;
            font-family: inherit;
        }

        .filter-section {
            background: var(--card-bg);
            padding: 12px;
            border-radius: 16px;
            box-shadow: var(--shadow-sm);
            margin-bottom: 20px;
            border: 1px solid #e2e8f0;
        }
        
        .filter-basic {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .filter-basic .filter-control {
            flex-grow: 1;
        }

        .filter-advanced {
            display: none;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 8px;
            margin-top: 10px;
            padding-top: 10px;
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
            padding: 0 14px;
            border-radius: 12px;
            cursor: pointer;
            white-space: nowrap;
            font-family: inherit;
            height: 42px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        .filter-control input, .filter-control select {
            padding: 0 14px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            font-size: 13px;
            width: 100%;
            height: 42px;
            background-color: #f8fafc;
            color: var(--text-main);
            font-family: inherit;
            outline: none;
        }
        .filter-control input:focus, .filter-control select:focus { 
            background-color: #fff;
            border-color: var(--primary); 
            box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12); 
        }

        .category-section { 
            margin-bottom: 24px; 
            background: var(--card-bg); 
            padding: 16px; 
            border-radius: 20px; 
            box-shadow: var(--shadow-sm); 
            border: 1px solid #e2e8f0; 
        }
        .featured-section { 
            background: linear-gradient(180deg, #fffbeb 0%, #ffffff 100%); 
            border: 1px solid #fde68a; 
        }
        .category-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1.5px solid #f1f5f9; }
        .featured-section .category-header { border-bottom-color: #fef3c7; }
        
        .cat-title-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .category-header h2 { margin: 0; font-size: 16px; font-weight: 800; color: var(--text-main); letter-spacing: -0.2px; }
        .featured-section .category-header h2 { color: #b45309; }
        
        .count-tag { background: #f1f5f9; color: var(--text-muted); padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; }
        .featured-section .count-tag { background: #fef3c7; color: #b45309; }

        .btn-expand-cat {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            color: var(--text-main);
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11.5px;
            font-weight: 700;
            cursor: pointer;
            font-family: inherit;
            white-space: nowrap;
        }

        .scroll-container { position: relative; display: flex; align-items: center; }
        .scroll-btn {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: white;
            border: 1px solid #e2e8f0;
            box-shadow: var(--shadow-md);
            cursor: pointer;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            color: var(--text-main);
        }
        .scroll-btn.left { left: -14px; }
        .scroll-btn.right { right: -14px; }

        .horizontal-scroll {
            display: flex;
            gap: 14px;
            overflow-x: auto;
            padding: 4px 2px 12px 2px;
            scroll-behavior: smooth;
            width: 100%;
            -webkit-overflow-scrolling: touch;
        }
        .horizontal-scroll::-webkit-scrollbar { display: none; }

        .card {
            flex: 0 0 175px;
            background: var(--card-bg);
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            box-sizing: border-box;
            box-shadow: var(--shadow-sm);
            overflow: hidden;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .card:active { transform: scale(0.98); }
        
        .card-top-bar { position: absolute; top: 8px; left: 8px; z-index: 2; }
        .badge { 
            display: inline-block;
            background: rgba(15, 23, 42, 0.75); 
            backdrop-filter: blur(6px);
            color: #fbbf24; 
            padding: 3px 8px; 
            border-radius: 8px; 
            font-size: 10px; 
            font-weight: 800; 
            border: 0.5px solid rgba(255, 255, 255, 0.2);
        }

        .img-wrapper { width: 100%; height: 135px; overflow: hidden; position: relative; background: #f8fafc; }
        .img-wrapper.no-img { display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 12px; font-weight: 600; }
        .card img { width: 100%; height: 100%; object-fit: cover; }

        .card-body { padding: 10px 10px 4px 10px; flex-grow: 1; }
        .card h3 { 
            margin: 0 0 4px 0; 
            font-size: 13.5px; 
            font-weight: 700;
            line-height: 1.3;
            height: 35px; 
            overflow: hidden; 
            display: -webkit-box; 
            line-clamp: 2;
            -webkit-line-clamp: 2; 
            -webkit-box-orient: vertical; 
            color: var(--text-main);
        }
        .card .meta { font-size: 11px; color: var(--text-muted); margin: 2px 0; font-weight: 500; }
        .card .producer-info { font-size: 10.5px; color: var(--primary-dark); margin: 2px 0 6px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }

        .btn-detail { 
            display: block; 
            text-align: center; 
            background: var(--primary-gradient); 
            color: white; 
            padding: 8px 10px; 
            text-decoration: none; 
            border-radius: 10px; 
            font-weight: 700; 
            font-size: 11.5px; 
            margin: 6px 10px 10px 10px; 
            box-shadow: 0 2px 6px rgba(5, 150, 105, 0.2);
        }

        footer { text-align: center; padding: 24px; color: var(--text-muted); font-size: 12px; margin-top: 30px; background: white; border-top: 1px solid #e2e8f0; }

        @media (min-width: 768px) {
            header { padding: 36px 20px 28px 20px; border-radius: 0 0 32px 32px; }
            header h1 { font-size: 28px; }
            header p { font-size: 14.5px; }
            .container { padding: 0 20px; margin: 24px auto; }
            .card { flex: 0 0 220px; border-radius: 20px; }
            .img-wrapper { height: 160px; }
            .card h3 { font-size: 15px; height: 40px; }
            .category-header h2 { font-size: 19px; }
        }

        @media (max-width: 767px) {
            .scroll-btn { display: none; }
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
                <a href="${FACEBOOK_URL}" target="_blank" class="social-icon-btn icon-fb" title="Facebook">
                    ${fbSvg}
                </a>
                <a href="${TIKTOK_URL}" target="_blank" class="social-icon-btn icon-tt" title="TikTok">
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
        <div class="social-contact" style="margin-top: 8px;">
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

        console.log(' 🎨 Đã khôi phục đầy đủ đoạn giới thiệu ban đầu!');

    } catch (error) {
        console.error('❌ Có lỗi xảy ra:', error.message);
    }
}

buildWebsite();
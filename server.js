const express = require('express');
const app = express();
const port = 3000;
const path = require('path');
const connectToDb = require('./DB/connection').connectToDb;
const { getWines } = require('./DB/wineService');
const multer = require('multer');
const fs = require('fs');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public', 'images')); 
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'home.html'));
});

app.get('/wines', async (req, res) => {
    
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        try {
            const db = await connectToDb();
            const wines = await getWines(db);
            return res.json(wines);
        } catch (error) {
            return res.status(500).json({ error: 'Error fetching wines from MongoDB' });
        }
    }
    res.sendFile(path.join(__dirname, 'public', 'pages', 'wine.html'));
});

app.get('/wines/volume', async (req, res) => {

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        try {
            const db = await connectToDb();
            const wines = await getWines(db, { volume: { $gte: 750, $lte: 1000 } });
            return res.json(wines);
        } catch (error) {
            return res.status(500).json({ error: 'Error fetching wines from MongoDB' });
        }
    }
    res.sendFile(path.join(__dirname, 'public', 'pages', 'wine_750ml.html'));   
});

app.get('/wines/vang', async (req, res) => {

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        try {
            const db = await connectToDb();
            const wines = await getWines(db, { category: 'Vang' });
            return res.json(wines);
        } catch (error) {
            return res.status(500).json({ error: 'Error fetching wines from MongoDB' });
        }
    }
    res.sendFile(path.join(__dirname, 'public', 'pages', 'wine_vang.html'));
});

app.get('/wines/price', async (req, res) => {

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        try {
            const db = await connectToDb();
            const wines = await getWines(db, { price: { $gte: 65000, $lte: 750000 } });
            return res.json(wines);
        } catch (error) {
            return res.status(500).json({ error: 'Error fetching wines from MongoDB' });
        }
    }
    res.sendFile(path.join(__dirname, 'public', 'pages', 'wine_price.html'));
});

app.get('/wines/search', async (req, res) => {

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        const keyword = req.query.keyword || '';
        // console.log('Từ khóa tìm kiếm:', keyword);
        try {
            const db = await connectToDb();
            let searchQuery = {
                $or: [
                    { name: { $regex: keyword, $options: 'i' } },
                    { "origin.country": { $regex: keyword, $options: 'i' } },
                    { "origin.region": { $regex: keyword, $options: 'i' } },
                    { "origin.producer": { $regex: keyword, $options: 'i' } },
                ]
            };
            const inputPrice = Number(keyword);
            if (!isNaN(inputPrice) && keyword.trim() !== '') {
                if (inputPrice >= 1000000) { 
                    searchQuery.$or.push({ price: { $gte: inputPrice } });
                } 
                else { 
                    const upperLimit = inputPrice + 100000; 
                    searchQuery.$or.push({ price: { $gte: inputPrice, $lte: upperLimit   } });
                }
            }

            const liquors = await db.collection('wines').find(searchQuery).toArray();

            // console.log('Kết quả tìm kiếm:', liquors);
            return res.json(liquors);

        } catch (error) {
            console.error('Lỗi khi tìm kiếm:', error);
            return res.status(500).json({ error: 'Error fetching wines from MongoDB' });
        }
    }
    res.sendFile(path.join(__dirname, 'public', 'pages', 'searchwine.html'));
});

app.get('/wines/:id', async (req, res) => {

    const acceptsJSON = req.accepts('json');
    const acceptsHTML = req.accepts('html');

    if (acceptsJSON && !acceptsHTML) {
        try {
            const wineId = req.params.id;
            const db = await connectToDb();
            const wine = await db.collection('wines').findOne({ id: wineId });
            
            if (wine) {
                return res.json(wine);
            } else {
                return res.status(404).json({ error: 'Wine not found' });
            }   
        } catch (error) {
            console.error('Lỗi khi truy xuất database:', error);
            return res.status(500).json({ error: 'Error fetching wine from MongoDB' });
        }
    } 
    
    else {
        return res.sendFile(path.join(__dirname, 'public', 'pages', 'detailwine.html'));
    }
});

app.get('/updatewine', (req, res) => {
    
    res.sendFile(path.join(__dirname, 'public', 'pages', 'updatewine.html'));
});

app.get('/updatewine/detail', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'updatewine_detail.html'));
});

app.put('/wines/update/:id', upload.single('image'), async (req, res) => {
    const id = req.params.id;
    
    const {
        name,
        category,
        volume,
        price,
        isAvailable,
        origin_country,
        origin_region,
        origin_producer,
        tags,
        old_image
    } = req.body;

    try {
        const imageName = req.file ? req.file.filename : old_image;

        let tagsArray = [];
        if (tags) {
            tagsArray = tags.split(',').map(t => t.trim()).filter(Boolean);
        }

        const originObj = {
            country: origin_country || '',
            region: origin_region || '',
            producer: origin_producer || ''
        };

        const db = await connectToDb();
        
        const result = await db.collection('wines').updateOne(
            { id: id },
            {
                $set: {
                    name: name || '',
                    category: category || '',
                    image: imageName,
                    isAvailable: (isAvailable === 'true' || isAvailable === 'on' || isAvailable === true),
                    origin: originObj,
                    tags: tagsArray,
                    volume: volume ? Number(volume) : 0,
                    price: price ? Number(price) : 0
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Không tìm thấy rượu để cập nhật' });
        }

        res.json({ message: 'Cập nhật thông tin rượu thành công' });

    } catch (err) {
        console.error('Lỗi khi cập nhật dữ liệu:', err);
        res.status(500).json({ message: 'Lỗi server khi cập nhật' });
    }
});

app.get('/addwine', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'addwine.html'));
});

app.post('/api/addwines', upload.array('images'), async (req, res) => {
    try {
        const winesData = req.body.wines;
        const files = req.files;
        
        if (!winesData || !Array.isArray(winesData)) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
        }

        let winesArray = [];

        winesData.forEach((item, index) => {
            const imageName = files && files[index] ? files[index].filename : 'default.png';

            let tagsArray = [];
            if (item.tags) {
                try {
                    const parsed = JSON.parse(item.tags);
                    if (Array.isArray(parsed)) tagsArray = parsed;
                    else if (typeof parsed === 'string') tagsArray = parsed.split(',').map(t => t.trim()).filter(Boolean);
                } catch (e) {
                    tagsArray = item.tags.split(',').map(t => t.trim()).filter(Boolean);
                }
            }

            let originObj = {};
            if (item.origin) { 
                if (item.origin.country) originObj.country = item.origin.country;
                if (item.origin.region) originObj.region = item.origin.region;
                if (item.origin.producer) originObj.producer = item.origin.producer;
            }

            winesArray.push({
                id: item.id || undefined,
                name: item.name || '',
                category: item.category || '',
                image: imageName,
                isAvailable: (item.isAvailable === 'true'),
                origin: Object.keys(originObj).length > 0 ? originObj : undefined,
                tags: tagsArray,
                volume: item.volume ? Number(item.volume) : 0,
                price: item.price ? Number(item.price) : 0
            });
        });

        const db = await connectToDb();
        const result = await db.collection('wines').insertMany(winesArray);

        res.json({
            success: true,
            message: `Đã thêm thành công ${result.insertedCount} sản phẩm vào danh sách!`
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi trên server'
        });
    }
});

app.get('/deletewine', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'deletewine.html'));
});

app.delete('/wines/delete/:id', async (req, res) => {
    const wineId = req.params.id;

    try {
        const db = await connectToDb();
        const result = await db.collection('wines').deleteOne({ id: wineId });
        if (result.deletedCount === 1) {
            res.json({ message: `Đã xóa thành công rượu có ID: ${wineId}` });
        } else {
            res.status(404).json({ message: 'Không tìm thấy rượu để xóa' });
        }
    } catch (error) {
        console.error('Lỗi khi xóa:', error);
        res.status(500).json({ message: 'Lỗi server khi thực hiện xóa' });
    }
});

app.delete('/wines/delete-many', async (req, res) => {
    const keyword = req.query.keyword || '';

    if (!keyword) {
        return res.status(400).json({ message: 'Không có từ khóa để xóa' });
    }

    try {
        const db = await connectToDb();
        
        const deleteQuery = {
            $or: [
                { name: { $regex: keyword, $options: 'i' } },
                { "origin.country": { $regex: keyword, $options: 'i' } },
                { "origin.region": { $regex: keyword, $options: 'i' } },
                { "origin.producer": { $regex: keyword, $options: 'i' } }
            ]
        };

        const inputPrice = Number(keyword);
        if (!isNaN(inputPrice) && keyword.trim() !== '') {
            if (inputPrice >= 1000000) {
                deleteQuery.$or.push({ price: { $gte: inputPrice } });
            } else {
                const upperLimit = inputPrice + 100000; 
                deleteQuery.$or.push({ price: { $gte: inputPrice, $lte: upperLimit } });
            }
        }

        const result = await db.collection('wines').deleteMany(deleteQuery);

        res.json({ message: `Đã dọn dẹp thành công <strong>${result.deletedCount}</strong> sản phẩm khỏi hệ thống!` });

    } catch (error) {
        res.status(500).json({ message: 'Lỗi server khi xóa nhiều sản phẩm' });
    }
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'about.html'));
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
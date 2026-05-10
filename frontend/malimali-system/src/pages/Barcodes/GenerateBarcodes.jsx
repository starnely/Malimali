import { MdDownload } from 'react-icons/md';
import BarcodeImage from './BarcodeImage';
import s from '@/styles/Barcodes.module.css';

export default function GenerateBarcodes({ products, searchQuery, setSearchQuery, handleDownload }) {
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className={s.generateWrap}>
            <div className={s.generateToolbar}>
                <p className={s.generateHint}>Print these labels and stick them on your products.</p>
                <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className={s.generateSearch}
                />
            </div>
            <div className={s.barcodeGrid}>
                {filteredProducts.map(product => (
                    <div key={product._id} className={s.barcodeCard}>
                        <div style={{ display: 'none' }}><svg id={`barcode-dl-${product._id}`} /></div>
                        <div className={s.barcodeImgWrap}>
                            <BarcodeImage value={product.barcode || product._id} />
                        </div>
                        <div className={s.barcodeCardInfo}>
                            <div className={s.barcodeCardName}>{product.name}</div>
                            <div className={s.barcodeCardCat}>{product.category}</div>
                            <div className={s.barcodeCardPrice}>KSh {Number(product.sellPrice).toLocaleString()}</div>
                            <div className={`${s.barcodeCardStock} ${product.stock <= 5 ? s.barcodeCardStockLow : s.barcodeCardStockOk}`}>
                                Stock: {product.stock}
                            </div>
                            <div className={s.barcodeCardBarcode}>Barcode: {product.barcode}</div>
                        </div>
                        <button onClick={() => handleDownload(product)} className={s.downloadBtn}>
                            <MdDownload style={{ fontSize: '16px' }} /> Download Label
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
import { MdPrint } from 'react-icons/md';
import s from '@/styles/Barcodes.module.css';

export default function Receipt({ receipt, onClose }) {
    // Standard browser print function
    const handlePrint = () => window.print();

    // Safety check: if receipt isn't loaded yet, don't crash the app
    if (!receipt) return null;

    const storeName = receipt.store || "Retail Point of Sale";
    const cashierName = receipt.cashier || "Staff";

    return (
        <div className={s.overlay}>
            <div className={s.receiptPaper}>

                {/* ── HEADER ── */}
                <div className={s.rHeaderCenter}>
                    <div className={s.rCompany}>{storeName}</div>
                    <div className={s.rAddress}>Business Address Line</div>
                    <div className={s.rAddress}>Tel: +254 XXX XXX XXX</div>

                    <div className={s.rMetaSmall}>
                        Receipt ID: {receipt.saleId || receipt.receiptId || 'N/A'}
                    </div>
                    <div className={s.rMetaSmall}>
                        {receipt.date || new Date().toLocaleString()}
                    </div>
                </div>

                <div className={s.rDivider} />

                {/* ── TABLE HEADER ── */}
                <div className={s.rTableHeader}>
                    <span>Qty</span>
                    <span>Description</span>
                    <span>Amount</span>
                </div>

                {/* ── ITEMS ── */}
                {(receipt.items || []).map((item, i) => (
                    <div key={i} className={s.rRow}>
                        <span>{item.qty}</span>

                        <div className={s.rDesc}>
                            <div>{item.name}</div>
                            <div className={s.rSub}>
                                @ KSh {Number(item.price || item.sellPrice || 0).toLocaleString()}
                            </div>
                        </div>

                        <span>
                            KSh {(Number(item.price || item.sellPrice || 0) * item.qty).toLocaleString()}
                        </span>
                    </div>
                ))}

                <div className={s.rDivider} />

                {/* ── SUMMARY ── */}
                {receipt.paymentInfo?.discount > 0 && (
                    <div className={s.rSummaryRow}>
                        <span>Discount</span>
                        <span>- KSh {Number(receipt.paymentInfo.discount).toLocaleString()}</span>
                    </div>
                )}

                <div className={s.rSummaryRow}>
                    <span className="font-bold">Total</span>
                    <span className="font-bold">
                        KSh {Number(receipt.total || receipt.finalTotal || 0).toLocaleString()}
                    </span>
                </div>

                <div className={s.rSummaryRow}>
                    <span>Paid via</span>
                    <span className="capitalize">
                        {receipt.paymentInfo?.paymentMethod || receipt.paymentMethod || 'N/A'}
                    </span>
                </div>

                {/* ── PAYMENT DETAILS ── */}
                {receipt.paymentInfo?.paymentMethod === 'cash' && receipt.paymentInfo?.change > 0 && (
                    <div className={s.rSummaryRow}>
                        <span>Change</span>
                        <span>KSh {Number(receipt.paymentInfo.change).toLocaleString()}</span>
                    </div>
                )}

                {receipt.paymentInfo?.paymentMethod === 'mpesa' && (
                    <div className={s.rSummaryRow}>
                        <span>M-Pesa No</span>
                        <span>{receipt.paymentInfo.mpesaPhone}</span>
                    </div>
                )}

                {receipt.paymentInfo?.paymentMethod === 'split' && (
                    <>
                        <div className={s.rSummaryRow}>
                            <span>Cash Part</span>
                            <span>KSh {Number(receipt.paymentInfo.cashPart).toLocaleString()}</span>
                        </div>
                        <div className={s.rSummaryRow}>
                            <span>M-Pesa Part</span>
                            <span>KSh {Number(receipt.paymentInfo.mpesaPart).toLocaleString()}</span>
                        </div>
                    </>
                )}

                {receipt.paymentInfo?.paymentMethod === 'credit' && (
                    <div className={s.rCreditNote}>
                        CREDIT SALE — UNPAID BALANCE
                        <br />
                        Customer: {receipt.paymentInfo.customerName || 'Walking Customer'}
                    </div>
                )}

                <div className={s.rDivider} />

                {/* ── FOOTER ── */}
                <div className={s.rFooter}>
                    <div>Served by: {cashierName}</div>
                    <div>Thank you for your business!</div>
                </div>

                {/* ── ACTION BUTTONS (HIDDEN IN PRINT) ── */}
                <div className={`${s.receiptActions} ${s.noPrint}`}>
                    <button onClick={onClose} className={s.receiptBtnSecondary}>
                        New Sale
                    </button>
                    <button onClick={handlePrint} className={s.receiptBtnPrimary}>
                        <MdPrint size={18} /> Print Receipt
                    </button>
                </div>

            </div>
        </div>
    );
}
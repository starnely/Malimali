import { MdPrint } from 'react-icons/md';
import s from '@/styles/Barcodes.module.css';

export default function Receipt({ receipt, onClose }) {
    const handlePrint = () => window.print()

    return (
        <div className={s.overlay}>
            <div className={s.receiptPaper}>

                {/* ── HEADER ── */}
                <div className={s.rHeaderCenter}>
                    <div className={s.rCompany}>Malimali POS</div>
                    <div className={s.rAddress}>Your Business Address</div>
                    <div className={s.rAddress}>Tel: +254 XXX XXX XXX</div>

                    <div className={s.rMetaSmall}>
                        Receipt: {receipt.receiptId}
                    </div>
                    <div className={s.rMetaSmall}>
                        {receipt.date} {receipt.time}
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
                {receipt.items.map((item, i) => (
                    <div key={i} className={s.rRow}>
                        <span>{item.qty}</span>

                        <div className={s.rDesc}>
                            <div>{item.name}</div>
                            <div className={s.rSub}>
                                @ KSh {Number(item.sellPrice).toLocaleString()}
                            </div>
                        </div>

                        <span>KSh {Number(item.total).toLocaleString()}</span>
                    </div>
                ))}

                <div className={s.rDivider} />

                {/* ── SUMMARY ── */}
                {receipt.discount > 0 && (
                    <div className={s.rSummaryRow}>
                        <span>Discount</span>
                        <span>- KSh {Number(receipt.discount).toLocaleString()}</span>
                    </div>
                )}

                <div className={s.rSummaryRow}>
                    <span>Total</span>
                    <span>KSh {Number(receipt.finalTotal).toLocaleString()}</span>
                </div>

                <div className={s.rSummaryRow}>
                    <span>Paid via</span>
                    <span>
                        {receipt.paymentMethod === 'mpesa' ? 'M-Pesa'
                            : receipt.paymentMethod === 'cash' ? 'Cash'
                                : receipt.paymentMethod === 'split' ? 'Split'
                                    : 'Credit'}
                    </span>
                </div>

                {/* ── PAYMENT DETAILS ── */}
                {receipt.paymentMethod === 'cash' && receipt.change > 0 && (
                    <div className={s.rSummaryRow}>
                        <span>Change</span>
                        <span>KSh {Number(receipt.change).toLocaleString()}</span>
                    </div>
                )}

                {receipt.paymentMethod === 'mpesa' && receipt.mpesaPhone && (
                    <div className={s.rSummaryRow}>
                        <span>M-Pesa No</span>
                        <span>{receipt.mpesaPhone}</span>
                    </div>
                )}

                {receipt.paymentMethod === 'split' && (
                    <>
                        <div className={s.rSummaryRow}>
                            <span>Cash</span>
                            <span>KSh {Number(receipt.cashPart).toLocaleString()}</span>
                        </div>
                        <div className={s.rSummaryRow}>
                            <span>M-Pesa</span>
                            <span>KSh {Number(receipt.mpesaPart).toLocaleString()}</span>
                        </div>
                        {receipt.change > 0 && (
                            <div className={s.rSummaryRow}>
                                <span>Change</span>
                                <span>KSh {Number(receipt.change).toLocaleString()}</span>
                            </div>
                        )}
                    </>
                )}

                {receipt.paymentMethod === 'credit' && (
                    <div className={s.rCreditNote}>
                        Credit Sale — Amount Owed: KSh {Number(receipt.finalTotal).toLocaleString()}
                    </div>
                )}

                <div className={s.rDivider} />

                {/* ── FOOTER ── */}
                <div className={s.rFooter}>
                    <div>Served by: {receipt.soldBy}</div>
                    <div>Thank you!</div>
                </div>

                {/* ── ACTION BUTTONS (HIDDEN IN PRINT) ── */}
                <div className={`${s.receiptActions} ${s.noPrint}`}>
                    <button onClick={onClose} className={s.receiptBtnSecondary}>
                        New Sale
                    </button>
                    <button onClick={handlePrint} className={s.receiptBtnPrimary}>
                        <MdPrint /> Print
                    </button>
                </div>

            </div>
        </div>
    );
}
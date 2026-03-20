import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useBoardStore } from '../../store/boardStore';
import { X, Copy, Check } from 'lucide-react';
import styles from './InviteDialog.module.css';

export default function InviteDialog({ boardId, onClose }) {
  const [inviteData, setInviteData] = useState(null);
  const [copied, setCopied] = useState(false);
  const getInvite = useBoardStore((s) => s.getInvite);

  useEffect(() => {
    getInvite(boardId).then(setInviteData);
  }, [boardId, getInvite]);

  const handleCopy = async () => {
    if (inviteData?.inviteUrl) {
      await navigator.clipboard.writeText(inviteData.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={18} />
        </button>

        <h3 className={styles.title}>Invite to Board</h3>

        {inviteData ? (
          <>
            <div className={styles.qr}>
              <QRCodeSVG
                value={inviteData.inviteUrl}
                size={180}
                bgColor="transparent"
                fgColor="#e8e8f0"
              />
            </div>

            <div className={styles.linkRow}>
              <input
                className={styles.linkInput}
                value={inviteData.inviteUrl}
                readOnly
              />
              <button className={styles.copyBtn} onClick={handleCopy}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </>
        ) : (
          <div className={styles.loading}>Loading...</div>
        )}
      </div>
    </div>
  );
}

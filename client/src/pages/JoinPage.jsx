import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useBoardStore } from '../store/boardStore';

export default function JoinPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const joinByCode = useBoardStore((s) => s.joinByCode);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate(`/login?redirect=/join/${code}`);
      return;
    }

    joinByCode(code)
      .then((data) => navigate(`/board/${data.boardId}`))
      .catch(() => setError('Invalid or expired invite link'));
  }, [code, token, navigate, joinByCode]);

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--danger)' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
      Joining board...
    </div>
  );
}

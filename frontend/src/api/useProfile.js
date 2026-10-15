import { useEffect, useState } from 'react';
import api from './client.js';

export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('profile/')
      .then((response) => {
        setProfile(response.data);
      })
      .catch(() => {
        setProfile(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { profile, loading };
}


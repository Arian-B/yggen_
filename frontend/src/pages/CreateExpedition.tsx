import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * CreateExpedition is superseded by LandingPage's search bar.
 * This component just redirects home to avoid a dead route.
 */
const CreateExpedition = () => {
  const navigate = useNavigate();
  useEffect(() => { navigate('/', { replace: true }); }, [navigate]);
  return null;
};

export default CreateExpedition;

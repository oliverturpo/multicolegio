import React from 'react';
import { StatusBar } from 'expo-status-bar';
import EscogerColegio from './src/screens/EscogerColegio';
import Login from './src/screens/Login';
import CambiarPassword from './src/screens/CambiarPassword';
import MisHijos from './src/screens/MisHijos';
import Asistencias from './src/screens/Asistencias';

// Navegación por estado (sin librerías nativas) — arranca al toque en Expo Go.
export default function App() {
  const [screen, setScreen] = React.useState('colegio');
  const [colegio, setColegio] = React.useState(null);
  const [token, setToken] = React.useState(null);
  const [apoderado, setApoderado] = React.useState(null);
  const [hijo, setHijo] = React.useState(null);

  // La barra de estado es clara sobre las pantallas de fondo navy.
  const barraClara = screen === 'colegio' || screen === 'hijos' || screen === 'asistencias';

  function reset() {
    setToken(null); setApoderado(null); setHijo(null);
    setScreen('colegio'); setColegio(null);
  }

  let vista;
  if (screen === 'colegio') {
    vista = (
      <EscogerColegio
        onSelect={(c) => { setColegio(c); setScreen('login'); }}
      />
    );
  } else if (screen === 'login') {
    vista = (
      <Login
        colegio={colegio}
        onBack={() => setScreen('colegio')}
        onLogin={(data) => {
          setToken(data.access);
          setApoderado(data.apoderado);
          setScreen(data.debe_cambiar_password ? 'cambiar' : 'hijos');
        }}
      />
    );
  } else if (screen === 'cambiar') {
    vista = (
      <CambiarPassword
        colegio={colegio}
        token={token}
        onDone={() => setScreen('hijos')}
      />
    );
  } else if (screen === 'hijos') {
    vista = (
      <MisHijos
        colegio={colegio}
        token={token}
        onOpenHijo={(h) => { setHijo(h); setScreen('asistencias'); }}
        onLogout={reset}
      />
    );
  } else if (screen === 'asistencias') {
    vista = (
      <Asistencias
        colegio={colegio}
        token={token}
        hijo={hijo}
        onBack={() => setScreen('hijos')}
      />
    );
  }

  return (
    <>
      <StatusBar style={barraClara ? 'light' : 'dark'} />
      {vista}
    </>
  );
}

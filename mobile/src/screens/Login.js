import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, KeyboardAvoidingView,
  Platform, StyleSheet,
} from 'react-native';
import { Screen, Button, Field, ErrorBox } from '../ui';
import { C } from '../theme';
import { login } from '../api';

export default function Login({ colegio, onBack, onLogin }) {
  const [dni, setDni] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function ingresar() {
    setError('');
    if (dni.length < 8 || !password) {
      setError('Ingresa tu DNI (8 dígitos) y tu contraseña.');
      return;
    }
    setLoading(true);
    try {
      const data = await login(colegio.dominio, dni, password);
      onLogin(data); // { access, debe_cambiar_password, apoderado }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 22 }} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: C.sub, fontSize: 20, fontWeight: '700' }}>‹</Text>
            <Text style={{ color: C.sub, fontSize: 14 }}>{colegio.nombre}</Text>
          </TouchableOpacity>

          <Text style={s.h1}>Iniciar sesión</Text>

          {/* Pestañas de rol (personal = próximamente) */}
          <View style={s.seg}>
            <View style={[s.segItem, s.segAct]}>
              <Text style={{ color: C.navy, fontWeight: '700', fontSize: 13 }}>Soy apoderado</Text>
            </View>
            <View style={s.segItem}>
              <Text style={{ color: C.sub, fontWeight: '700', fontSize: 13 }}>Soy del colegio</Text>
            </View>
          </View>

          <Field
            label="DNI"
            value={dni}
            onChangeText={(t) => setDni(t.replace(/[^0-9]/g, ''))}
            placeholder="Tu número de DNI"
            keyboardType="number-pad"
            maxLength={8}
          />
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />

          <ErrorBox message={error} />

          <Button title="Ingresar" onPress={ingresar} loading={loading} />

          <Text style={s.hint}>
            La primera vez, tu usuario y contraseña son tu <Text style={{ fontWeight: '700' }}>DNI</Text>.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  h1: { color: C.ink, fontSize: 24, fontWeight: '800', marginTop: 18 },
  seg: {
    flexDirection: 'row', backgroundColor: '#eef2f7', borderRadius: 12,
    padding: 4, gap: 4, marginTop: 16,
  },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  segAct: { backgroundColor: '#fff' },
  hint: { color: C.sub, fontSize: 12, textAlign: 'center', marginTop: 18, lineHeight: 18 },
});

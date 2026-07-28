import React from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { Screen, Button, Field, ErrorBox } from '../ui';
import { C } from '../theme';
import { cambiarPassword } from '../api';

export default function CambiarPassword({ colegio, token, onDone }) {
  const [p1, setP1] = React.useState('');
  const [p2, setP2] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function guardar() {
    setError('');
    if (p1.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (p1 !== p2)     { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    try {
      await cambiarPassword(colegio.dominio, token, p1);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 22 }} keyboardShouldPersistTaps="handled">
          <View style={s.banner}>
            <Text style={{ color: C.tardanza, fontWeight: '600', fontSize: 13 }}>
              🔐  Primer ingreso — por seguridad, crea tu propia contraseña.
            </Text>
          </View>

          <Text style={s.h1}>Nueva contraseña</Text>
          <Text style={s.sub}>Elige una clave que solo tú conozcas.</Text>

          <Field label="Nueva contraseña" value={p1} onChangeText={setP1} placeholder="••••••••" secureTextEntry />
          <Field label="Repetir contraseña" value={p2} onChangeText={setP2} placeholder="••••••••" secureTextEntry />

          <View style={{ marginTop: 14, gap: 7 }}>
            <Text style={s.rule}>✓  Mínimo 8 caracteres</Text>
            <Text style={s.rule}>✓  No puede ser solo tu DNI</Text>
          </View>

          <ErrorBox message={error} />

          <Button title="Guardar y continuar" variant="navy" onPress={guardar} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  banner: { backgroundColor: C.tardanzaBg, borderRadius: 11, padding: 12 },
  h1: { color: C.ink, fontSize: 24, fontWeight: '800', marginTop: 20 },
  sub: { color: C.sub, fontSize: 14, marginTop: 6 },
  rule: { color: C.sub, fontSize: 13 },
});

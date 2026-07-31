import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, Image,
  ActivityIndicator, RefreshControl, StyleSheet,
} from 'react-native';
import { Screen, Logo, Button, ErrorBox } from '../ui';
import { C, iniciales } from '../theme';
import { getColegios } from '../api';

export default function EscogerColegio({ onSelect }) {
  const [colegios, setColegios] = React.useState(null);
  const [error, setError] = React.useState('');
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState(null);
  const [refreshing, setRefreshing] = React.useState(false);

  // Recarga la lista. Se llama al montar y al deslizar hacia abajo, para
  // que un colegio recién dado de alta aparezca sin reiniciar la app.
  const cargar = React.useCallback(async () => {
    setError('');
    try {
      const data = await getColegios();
      setColegios(data);
      // Si el colegio elegido ya no está en la lista, deseleccionarlo.
      setSel((prev) =>
        prev && data.some((c) => c.dominio === prev.dominio) ? prev : null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  React.useEffect(() => { cargar(); }, [cargar]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  }, [cargar]);

  const lista = (colegios || []).filter((c) =>
    c.nombre.toLowerCase().includes(q.toLowerCase()));

  return (
    <Screen dark>
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: 30 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.gold}
            colors={[C.gold]}
            progressBackgroundColor={C.navyMid}
          />
        }
      >
        <Logo />
        <Text style={s.h1}>Bienvenido</Text>
        <Text style={s.sub}>
          Selecciona tu colegio para continuar. Desliza hacia abajo para
          actualizar la lista.
        </Text>

        <View style={s.search}>
          <Text style={{ color: '#9db2cc' }}>🔍</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar colegio…"
            placeholderTextColor="#9db2cc"
            style={{ flex: 1, color: '#fff', fontSize: 15 }}
          />
        </View>

        {colegios === null && !error ? (
          <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />
        ) : null}

        <ErrorBox message={error} />
        {error ? (
          <Button title="Reintentar" onPress={cargar} />
        ) : null}

        {lista.map((c) => {
          const on = sel?.dominio === c.dominio;
          return (
            <TouchableOpacity
              key={c.dominio}
              activeOpacity={0.8}
              onPress={() => setSel(c)}
              style={[s.school, on && s.schoolSel]}
            >
              {c.logo ? (
                <Image source={{ uri: c.logo }} style={s.schoolIc} resizeMode="cover" />
              ) : (
                <View style={s.schoolIc}>
                  <Text style={{ color: C.gold, fontWeight: '800', fontSize: 15 }}>
                    {iniciales(c.nombre)}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.schoolN}>{c.nombre}</Text>
                <Text style={s.schoolS}>{c.dominio}</Text>
              </View>
              {on ? <Text style={{ color: C.gold, fontWeight: '800', fontSize: 16 }}>✓</Text> : null}
            </TouchableOpacity>
          );
        })}

        {colegios && lista.length === 0 && !error ? (
          <Text style={[s.sub, { marginTop: 24 }]}>No hay colegios que coincidan.</Text>
        ) : null}

        <Button
          title="Continuar"
          disabled={!sel}
          onPress={() => onSelect(sel)}
        />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  h1: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 30 },
  sub: { color: '#b9cae0', fontSize: 14, marginTop: 6, lineHeight: 20 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)', borderRadius: 11, paddingHorizontal: 13, height: 46,
  },
  school: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 11, padding: 13,
    borderRadius: 13, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  schoolSel: { borderColor: C.gold, backgroundColor: 'rgba(251,191,36,0.12)' },
  schoolIc: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: C.navyMid,
    alignItems: 'center', justifyContent: 'center',
  },
  schoolN: { color: '#fff', fontWeight: '700', fontSize: 14 },
  schoolS: { color: '#9db2cc', fontSize: 12, marginTop: 2 },
});

import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  RefreshControl, StyleSheet,
} from 'react-native';
import { Screen, Pill } from '../ui';
import { C, iniciales } from '../theme';
import { getMisHijos } from '../api';

const AV_COLORS = [['#3b82f6', '#1e3a5f'], ['#e879a6', '#9d174d'], ['#34d399', '#065f46'], ['#f59e0b', '#92400e']];

export default function MisHijos({ colegio, token, onOpenHijo, onLogout }) {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);

  const cargar = React.useCallback(() => {
    return getMisHijos(colegio.dominio, token)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [colegio, token]);

  React.useEffect(() => { cargar(); }, [cargar]);

  async function onRefresh() {
    setRefreshing(true);
    setError('');
    await cargar();
    setRefreshing(false);
  }

  return (
    <Screen>
      {/* Header navy */}
      <View style={s.head}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={s.avatar}>
            <Text style={{ color: C.navy, fontWeight: '800', fontSize: 15 }}>
              {iniciales(data?.apoderado || '')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.hi}>Hola,</Text>
            <Text style={s.nm}>{data?.apoderado || '…'}</Text>
          </View>
          <TouchableOpacity onPress={onLogout}>
            <Text style={{ color: '#b9cae0', fontSize: 13, fontWeight: '600' }}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
      >
        {data === null && !error ? <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} /> : null}
        {error ? <Text style={{ color: C.ausente, fontWeight: '600' }}>{error}</Text> : null}

        {data ? (
          <Text style={s.label}>Mis hijos · {data.hijos.length}</Text>
        ) : null}

        {(data?.hijos || []).map((h, i) => {
          const [a, b] = AV_COLORS[i % AV_COLORS.length];
          return (
            <TouchableOpacity key={h.id} activeOpacity={0.85} onPress={() => onOpenHijo(h)} style={s.kid}>
              <View style={[s.kidPh, { backgroundColor: a, borderColor: b }]}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{iniciales(h.nombre_completo)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.kidN}>{h.nombre_completo}</Text>
                <Text style={s.kidG}>{h.grado_seccion}</Text>
              </View>
              {h.estado_hoy
                ? <Pill estado={h.estado_hoy} />
                : <Text style={{ color: '#cbd5e1', fontSize: 18 }}>›</Text>}
            </TouchableOpacity>
          );
        })}

        {data ? (
          <Text style={s.foot}>Toca un hijo para ver su historial de asistencias.</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { backgroundColor: C.navy, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  hi: { color: '#b9cae0', fontSize: 13 },
  nm: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2 },
  label: { color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
  kid: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderWidth: 1, borderColor: C.border, borderRadius: 15, padding: 13, marginTop: 12,
  },
  kidPh: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  kidN: { color: C.ink, fontWeight: '700', fontSize: 14.5 },
  kidG: { color: C.sub, fontSize: 12, marginTop: 2 },
  foot: { color: C.sub, fontSize: 13, marginTop: 18, lineHeight: 19 },
});

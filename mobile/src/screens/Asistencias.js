import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Screen, Pill } from '../ui';
import { C } from '../theme';
import { getAsistencias } from '../api';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fechaLarga(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DIAS[dt.getDay()]} ${d} ${MESES[m - 1]}`;
}

export default function Asistencias({ colegio, token, hijo, onBack }) {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    getAsistencias(colegio.dominio, token, hijo.id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [colegio, token, hijo]);

  const r = data?.resumen || {};

  return (
    <Screen>
      <View style={s.head}>
        <TouchableOpacity onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#b9cae0', fontSize: 20, fontWeight: '700' }}>‹</Text>
          <Text style={{ color: '#b9cae0', fontSize: 13 }}>Mis hijos</Text>
        </TouchableOpacity>
        <Text style={s.nm}>{hijo.nombre_completo}</Text>
        <Text style={s.gr}>{hijo.grado_seccion} · DNI {hijo.dni}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {data === null && !error ? <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} /> : null}
        {error ? <Text style={{ color: C.ausente, fontWeight: '600' }}>{error}</Text> : null}

        {data ? (
          <>
            <View style={s.sumRow}>
              <SumCard n={r.PRESENTE || 0} label="Presente" color={C.presente} />
              <SumCard n={r.TARDANZA || 0} label="Tardanza" color={C.tardanza} />
              <SumCard n={r.AUSENTE || 0} label="Ausente" color={C.ausente} />
            </View>

            <Text style={s.label}>Historial · {data.total} registros</Text>

            {data.asistencias.map((a, i) => (
              <View key={i} style={[s.row, i === data.asistencias.length - 1 && { borderBottomWidth: 0 }]}>
                <View>
                  <Text style={s.dt}>{fechaLarga(a.fecha)}</Text>
                  <Text style={s.dy}>{a.hora_registro ? `Ingreso ${a.hora_registro}` : 'Sin registro'}</Text>
                </View>
                <Pill estado={a.estado} />
              </View>
            ))}

            {data.total === 0 ? (
              <Text style={{ color: C.sub, marginTop: 20 }}>Aún no hay asistencias registradas.</Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function SumCard({ n, label, color }) {
  return (
    <View style={s.sumCard}>
      <Text style={[s.sumN, { color }]}>{n}</Text>
      <Text style={s.sumL}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { backgroundColor: C.navy, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  nm: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 10 },
  gr: { color: '#b9cae0', fontSize: 13, marginTop: 2 },
  sumRow: { flexDirection: 'row', gap: 8 },
  sumCard: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 13, paddingVertical: 12, alignItems: 'center' },
  sumN: { fontSize: 22, fontWeight: '800' },
  sumL: { fontSize: 11, fontWeight: '600', color: C.sub, marginTop: 5 },
  label: { color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase', marginTop: 20, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border },
  dt: { color: C.ink, fontSize: 14, fontWeight: '600' },
  dy: { color: C.sub, fontSize: 12, marginTop: 2 },
});

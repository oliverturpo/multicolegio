// Componentes de UI reutilizables (marca YachayQR).
import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { C, estadoInfo } from './theme';

const TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 50;

// Contenedor de pantalla con padding seguro. `dark` = fondo navy.
export function Screen({ children, dark, style }) {
  return (
    <View style={[
      { flex: 1, backgroundColor: dark ? C.navy : C.bg, paddingTop: TOP },
      style,
    ]}>
      {children}
    </View>
  );
}

export function Logo({ size = 34 }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{
        width: size, height: size, borderRadius: size * 0.26, backgroundColor: C.gold,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: C.navy, fontWeight: '800', fontSize: size * 0.5 }}>Y</Text>
      </View>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18, marginLeft: 9 }}>
        Yachay<Text style={{ color: C.gold }}>QR</Text>
      </Text>
    </View>
  );
}

export function Button({ title, onPress, variant = 'gold', loading, disabled, style }) {
  const bg = variant === 'gold' ? C.gold : variant === 'navy' ? C.navy : 'transparent';
  const fg = variant === 'gold' ? C.navy : variant === 'ghost' ? C.ink : '#fff';
  const off = disabled || loading;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={off ? undefined : onPress}
      style={[
        s.btn,
        { backgroundColor: bg, opacity: off ? 0.6 : 1 },
        variant === 'ghost' && { borderWidth: 1.5, borderColor: C.border },
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={fg} />
        : <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function Field({ label, value, onChangeText, placeholder, secureTextEntry,
                        keyboardType, autoCapitalize = 'none', maxLength }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <View style={{ marginTop: 14 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={[s.input, focus && { borderColor: C.goldDark }]}
      />
    </View>
  );
}

export function Pill({ estado }) {
  const info = estadoInfo(estado);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: info.bg, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 100,
    }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: info.color }} />
      <Text style={{ color: info.color, fontWeight: '700', fontSize: 11 }}>{info.label}</Text>
    </View>
  );
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <View style={{
      backgroundColor: C.ausenteBg, borderRadius: 11, padding: 11, marginTop: 14,
      flexDirection: 'row', gap: 8,
    }}>
      <Text style={{ color: C.ausente, fontWeight: '600', fontSize: 13, flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  label: { fontSize: 12, fontWeight: '600', color: C.sub, marginBottom: 6 },
  input: {
    height: 48, borderRadius: 11, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 15, color: C.ink,
  },
});

import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type Colors from "@/constants/colors";

const TIME_PRESETS = [
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "12:00",
  "14:00",
  "18:00",
  "20:00",
  "21:00",
];

type Props = {
  value: string;
  onChange: (value: string) => void;
  colors: (typeof Colors)["light"];
  label: string;
};

export function FirstDoseTimeEditor({ value, onChange, colors, label }: Props) {
  const [showPresets, setShowPresets] = useState(false);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View
          style={[styles.iconBadge, { backgroundColor: colors.primary + "18" }]}
        >
          <Feather name="clock" size={14} color={colors.primary} />
        </View>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Pressable
          onPress={() => setShowPresets((p) => !p)}
          style={[styles.toggleBtn, { borderColor: colors.border }]}
        >
          <Text style={[styles.toggleText, { color: colors.primary }]}>
            Presets
          </Text>
          <Feather
            name={showPresets ? "chevron-up" : "chevron-down"}
            size={13}
            color={colors.primary}
          />
        </Pressable>
        <TextInput
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
            },
          ]}
          value={value}
          onChangeText={(t) => {
            const cleaned = t.replace(/[^0-9:]/g, "").slice(0, 5);
            onChange(cleaned);
          }}
          placeholder="HH:MM"
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
      </View>
      {showPresets && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetScroll}
        >
          {TIME_PRESETS.map((preset) => (
            <Pressable
              key={preset}
              onPress={() => {
                onChange(preset);
                setShowPresets(false);
              }}
              style={[
                styles.preset,
                {
                  backgroundColor:
                    value === preset ? colors.primary : colors.surfaceSecondary,
                  borderColor: value === preset ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.presetText,
                  { color: value === preset ? "#fff" : colors.text },
                ]}
              >
                {preset}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  toggleText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  input: {
    width: 72,
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  presetScroll: { paddingBottom: 4, gap: 7, paddingLeft: 42 },
  preset: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

function formatDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function formatTime(d: Date) {
  return d.toTimeString().slice(0, 5);
}

export default function DateTimeField({
  value,
  mode = "date",
  onChange,
  placeholder,
  icon,
  colors,
}: {
  value?: string;
  mode?: "date" | "time" | "datetime";
  onChange: (iso: string) => void;
  placeholder?: string;
  icon?: string;
  colors?: any;
}) {
  const [show, setShow] = useState(false);
  const current = value ? new Date(value) : new Date();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors?.surface ?? "#fff",
          borderColor: colors?.border ?? "#ccc",
        },
      ]}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Pressable onPress={() => setShow(true)} style={styles.pressable}>
        <Text style={[styles.valueText, { color: colors?.text ?? "#000" }]}>
          {value
            ? mode === "time"
              ? formatTime(new Date(value))
              : formatDate(new Date(value))
            : (placeholder ?? (mode === "time" ? "HH:MM" : "YYYY-MM-DD"))}
        </Text>
      </Pressable>

      {show && (
        <DateTimePicker
          value={current}
          mode={mode === "datetime" ? "date" : mode}
          display="default"
          onChange={(_, selected) => {
            setShow(false);
            if (selected) {
              if (mode === "datetime") {
                // For simplicity return ISO of selected date (time can be chosen separately if needed)
                onChange(selected.toISOString());
              } else {
                onChange(selected.toISOString());
              }
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  icon: {
    fontSize: 14,
  },
  pressable: {
    flex: 1,
  },
  valueText: {
    fontSize: 16,
  },
});

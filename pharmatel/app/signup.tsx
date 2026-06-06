import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

export default function SignUpScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];
  const insets = useSafeAreaInsets();
  const { register, t } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacistName, setPharmacistName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isPatient = true;

  const canSubmit = useMemo(() => {
    if (!username.trim() || !password.trim()) return false;
    if (password !== confirmPassword) return false;
    return Boolean(name.trim() && email.trim() && phoneNumber.trim());
  }, [confirmPassword, email, name, password, phoneNumber, username]);

  const handleRegister = async () => {
    if (!canSubmit) {
      setError(t("fillRequiredFieldsAndMatchPasswords"));
      return;
    }

    setLoading(true);
    setError("");

    const result = await register({
      username: username.trim(),
      password,
      role: "PATIENT",
      name: name.trim(),
      email: email.trim(),
      phoneNumber: phoneNumber.trim(),
    });

    if (result.success) {
      router.replace("/(tabs)");
      return;
    }

    setError(result.error ?? t("registrationFailed"));
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
            paddingBottom: insets.bottom + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View
            style={[styles.logoContainer, { backgroundColor: colors.primary }]}
          >
            <Feather name="user-plus" size={34} color="#fff" />
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>
            {t("createAccountTitle")}
          </Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            {t("createAccountSubtitle")}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.cardShadow,
            },
          ]}
        >
          <Field
            label={t("username")}
            value={username}
            onChangeText={setUsername}
            placeholder="john.doe"
            icon="user"
            colors={colors}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field
            label={t("password")}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            icon="lock"
            colors={colors}
            secureTextEntry
          />
          <Field
            label={t("confirmPassword")}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            icon="lock"
            colors={colors}
            secureTextEntry
          />

          {isPatient ? (
            <>
              <Field
                label={t("fullName")}
                value={name}
                onChangeText={setName}
                placeholder="John Doe"
                icon="file-text"
                colors={colors}
              />
              <Field
                label={t("email")}
                value={email}
                onChangeText={setEmail}
                placeholder="john@example.com"
                icon="mail"
                colors={colors}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Field
                label={t("phoneNumber")}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="+1 555 000 000"
                icon="phone"
                colors={colors}
                keyboardType="phone-pad"
              />
            </>
          ) : (
            <>
              <Field
                label={t("pharmacyName")}
                value={pharmacyName}
                onChangeText={setPharmacyName}
                placeholder="CityMed Pharmacy"
                icon="home"
                colors={colors}
              />
              <Field
                label={t("pharmacistName")}
                value={pharmacistName}
                onChangeText={setPharmacistName}
                placeholder="Ahsan Rahman"
                icon="user"
                colors={colors}
              />
            </>
          )}

          {error ? (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: colors.error + "15",
                  borderColor: colors.error + "30",
                },
              ]}
            >
              <Feather name="alert-circle" size={14} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>
                {error}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleRegister}
            disabled={loading || !canSubmit}
            style={({ pressed }) => [
              styles.submitBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed || loading || !canSubmit ? 0.85 : 1,
              },
            ]}
          >
            <Text style={styles.submitText}>
              {loading ? t("creatingAccount") : t("createAccount")}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backLink,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.backLinkText, { color: colors.primary }]}>
              {t("backToSignIn")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  colors,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  icon: string;
  colors: any;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.surfaceSecondary,
            borderColor: colors.border,
          },
        ]}
      >
        <Feather name={icon as never} size={18} color={colors.textMuted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize ?? "none"}
          autoCorrect={autoCorrect ?? false}
          keyboardType={keyboardType}
          style={[styles.input, { color: colors.text }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  hero: {
    alignItems: "center",
    marginBottom: 24,
    gap: 10,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  roleRow: {
    flexDirection: "row",
    gap: 10,
  },

  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  backLink: {
    alignSelf: "center",
    paddingVertical: 4,
    marginTop: 2,
  },
  backLinkText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});

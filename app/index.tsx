import React, { useState, useEffect } from "react";
import { Text, View, StyleSheet, Button, FlatList, TouchableOpacity, Alert } from "react-native";

import * as Location from "expo-location";
import * as Clipboard from "expo-clipboard";
import { CameraView, CameraType, useCameraPermissions, BarcodeScanningResult } from "expo-camera";

import { connectDb } from "../src/database"; // Asegúrate de tener guardarCodigo, consultarCodigos y eliminarCodigo
import { ScannedCode } from "../src/models"; // Interfaz con { id, data, type }

const SERVER_URL = "http://localhost:3000";

export default () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedCodes, setScannedCodes] = useState<ScannedCode[]>([]);
  const [serverCodes, setServerCodes] = useState<ScannedCode[]>([]);

  useEffect(() => {
    async function init() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permiso de ubicación denegado");
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);

      const db = await connectDb();
      setScannedCodes(await db.consultarCodigos());
    }

    init();
    fetchServerCodes();
  }, []);

  const fetchServerCodes = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/codigos`);
      const data = await res.json();
      setServerCodes(data);
    } catch (error) {
      console.error("Error al obtener códigos del servidor:", error);
      setServerCodes([]);
    }
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View>
        <Text>Se requiere permiso de cámara</Text>
        <Button title="Conceder permiso" onPress={requestPermission} />
      </View>
    );
  }

  const onBarcodeScanned = async (result: BarcodeScanningResult) => {
    const { data, type } = result;
    alert(`Código escaneado: ${data}`);

    const db = await connectDb();
    try {
      await db.guardarCodigo(data, type || "qr");
      setScannedCodes(await db.consultarCodigos());
    } catch (err) {
      console.error("Error guardando en base de datos local:", err);
    }

    try {
      const response = await fetch(`${SERVER_URL}/codigos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data, type: type || "qr" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al guardar en servidor");
      }

      fetchServerCodes();
    } catch (error) {
      console.error("Error al guardar en servidor:", error);
    }
  };

  const syncAllToServer = async () => {
    const db = await connectDb();
    const allCodes = await db.consultarCodigos();

    for (const code of allCodes) {
      try {
        await fetch(`${SERVER_URL}/codigos`, {
          method: "POST",
          headers: {
            Accept: "application/json;encoding=utf-8",
            "Content-Type": "application/json;encoding=utf-8",
          },
          body: JSON.stringify({ data: code.data, type: code.type }),
        });
      } catch (error) {
        console.error("Error sincronizando código:", code.id, error);
      }
    }

    alert("Sincronización completa");
    fetchServerCodes();
  };

  const eliminarLocal = async (id: string) => {
    const db = await connectDb();
    try {
      await db.eliminarCodigo(id);
      setScannedCodes(await db.consultarCodigos());
    } catch (error) {
      console.error("Error eliminando código local:", error);
    }
  };

  const ScannedItem = ({ item }: { item: ScannedCode }) => {
    const onCopyPress = () => Clipboard.setStringAsync(item.data);
    const onDeletePress = () => {
      Alert.alert("Eliminar", "¿Seguro que quieres eliminar este código?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => eliminarLocal(item.id) },
      ]);
    };

    return (
      <View style={styles.card}>
        <Text>ID: {item.id}</Text>
        <Text>Data: {item.data}</Text>
        <Text>Type: {item.type}</Text>
        <View style={styles.cardButtons}>
          <Button title="Copiar" onPress={onCopyPress} />
          <Button title="Eliminar" color="red" onPress={onDeletePress} />
        </View>
      </View>
    );
  };

  return (
    <View style={{ padding: 10 }}>
      <Text style={{ fontWeight: "bold", marginBottom: 10 }}>
        GPS: {errorMsg ? errorMsg : JSON.stringify(location?.coords)}
      </Text>

      <CameraView
        facing={facing}
        style={styles.CameraView}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "code128", "datamatrix", "aztec"],
        }}
        onBarcodeScanned={onBarcodeScanned}
      />

      <Button
        title="Sincronizar códigos con servidor"
        onPress={syncAllToServer}
      />

      <Text style={styles.sectionTitle}>Códigos guardados en el servidor:</Text>
      <FlatList
        data={serverCodes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>ID: {item.id}</Text>
            <Text>Data: {item.data}</Text>
            <Text>Type: {item.type}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: "gray" }}>No hay códigos en el servidor.</Text>
        }
      />

      <Text style={styles.sectionTitle}>Códigos guardados localmente:</Text>
      <FlatList
        data={scannedCodes}
        keyExtractor={(item) => item.id}
        renderItem={ScannedItem}
        ListEmptyComponent={
          <Text style={{ color: "gray" }}>No hay códigos locales.</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  CameraView: {
    width: "100%",
    minHeight: 240,
    marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 5,
  },
  card: {
    padding: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 8,
  },
  cardButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
});

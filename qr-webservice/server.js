import { useState, useEffect } from "react";
import { Text, View, StyleSheet, Button, FlatList, TouchableOpacity, Alert } from "react-native";

import * as Location from "expo-location";
import * as Clipboard from "expo-clipboard";
import { CameraView, CameraType, useCameraPermissions, BarcodeScanningResult } from "expo-camera";

import { connectDb } from "../src/database";  

import axios from "axios";

const API_BASE = "http://TU_IP_LOCAL:3000"; // Reemplaza con tu IP local

export default function ScannerApp() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedCodes, setScannedCodes] = useState<ScannedCode[]>([]);

  useEffect(() => {
    async function initialize() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        return;
      }
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);

      // Obtener datos de la API remota
      try {
        const response = await axios.get(`${API_BASE}/codigos`);
        setScannedCodes(response.data);
      } catch (error) {
        console.log("Error al obtener códigos del servidor:", error);
      }
    }

    initialize();
  }, []);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View>
        <Text>Camera permission is required to use this app.</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  const onBarcodeScanned = async (result) => {
    const newCode = {
      data: result.data,
      type: result.type,
    };

    // Guardar localmente
    const db = await connectDb();
    await db.insertarCodigo(result.data, result.type);
    setScannedCodes(await db.consultarCodigos());

    // Enviar al servidor
    try {
      await axios.post(`${API_BASE}/codigos`, newCode, {
        headers: {
          "Content-Type": "application/json;encoding=utf-8",
          Accept: "application/json;encoding=utf-8",
        },
      });
    } catch (error) {
      console.log("Error al enviar código al servidor:", error);
    }

    Alert.alert("Código escaneado", result.data);
  };

  const ScannedItem = ({ item }) => {
    const onCopyPress = () => Clipboard.setStringAsync(item.data);

    return (
      <View style={styles.item}>
        <Text>{item.data}</Text>
        <TouchableOpacity onPress={onCopyPress}>
          <Text style={styles.copy}>Copiar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  let text = "Waiting...";
  if (errorMsg) text = errorMsg;
  else if (location) text = `Lat: ${location.coords.latitude}, Lon: ${location.coords.longitude}`;

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text>GPS: {text}</Text>
      <CameraView
        facing={facing}
        style={styles.CameraView}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "code128", "datamatrix", "aztec"],
        }}
        onBarcodeScanned={onBarcodeScanned}
      />
      <FlatList
        data={scannedCodes}
        keyExtractor={(item) => item.id}
        renderItem={ScannedItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  CameraView: {
    width: "100%",
    minHeight: 240,
  },
  item: {
    marginVertical: 8,
    padding: 12,
    backgroundColor: "#f1f1f1",
    borderRadius: 8,
  },
  copy: {
    color: "#007bff",
    marginTop: 4,
  },
});
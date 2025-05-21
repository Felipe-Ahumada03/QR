import React, { useState, useEffect } from "react";
import { Text, View, StyleSheet, Button, FlatList, TouchableOpacity } from "react-native";

import * as Location from "expo-location";
import * as Clipboard from "expo-clipboard";
import { CameraView, CameraType, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { connectDb } from "../src/database"; // Para guardar y leer códigos localmente (SQLite)
import { ScannedCode } from "../src/models"; // Para tipar los objetos de códigos escaneados

const SERVER_URL = 'http://localhost:3000';

export default () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedCodes, setScannedCodes] = useState<ScannedCode[]>([]);
  const [serverCodes, setServerCodes] = useState<ScannedCode[]>([]);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  useEffect(() => {
    async function getCurrentLocation() {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    }
    async function retrieveLocalDbData() {
      const db = await connectDb();
      setScannedCodes(await db.consultarCodigos());
    }
    getCurrentLocation();
    retrieveLocalDbData();
  }, []);

  // Nueva función para obtener códigos del servidor
  const fetchServerCodes = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/codigos`);
      const data = await res.json();
      setServerCodes(data);
    } catch (error) {
      setServerCodes([]);
    }
  };

  useEffect(() => {
    fetchServerCodes();
  }, []);

  if (!permission) {
    return <View />;
  }
  if (!permission.granted) {
    return (
      <View>
        <Text>Camera permission is required to use this app.</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  let text = "Waiting..";
  if (errorMsg) {
    text = errorMsg;
  } else if (location) {
    text = JSON.stringify(location);
  }

  const onBarcodeScanned = async function (result: BarcodeScanningResult) {
    console.log('Código escaneado:', result); // Log para depuración

    const mensaje = result.data;
    alert(`Código escaneado: ${mensaje}`);

    // Guardar en servidor
    try {
      const response = await fetch(`${SERVER_URL}/codigos`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: result.data,
          type: result.type || 'qr'
        }),
      });
      
      const responseData = await response.json();
      console.log('Respuesta del servidor:', responseData); // Log para depuración
      
      if (!response.ok) {
        throw new Error(`Error: ${responseData.message}`);
      }

      fetchServerCodes(); // Actualiza la lista después de guardar
    } catch (error) {
      console.error("Error al guardar en el servidor:", error);
      alert("Error al guardar en el servidor");
    }
  };

  // Nueva función para sincronizar todos los códigos locales al servidor
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
          body: JSON.stringify({
            data: code.data,
            type: code.type,
          }),
        });
      } catch (error) {
        console.error("Error sincronizando código:", code.id, error);
      }
    }
    alert("Sincronización completa");
  };

  const ScannedItem = function ({ item }: { item: ScannedCode }) {
    const onCopyPress = function () {
      Clipboard.setStringAsync(item.data);
    };
    return (
      <View>
        <Text>ID: {item.id}</Text>
        <Text>Data: {item.data}</Text>
        <Text>Type: {item.type}</Text>
        <TouchableOpacity onPress={onCopyPress}>
          <Text>Copiar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View>
      <Text>GPS: {text}</Text>

      <CameraView
        facing={facing}
        style={styles.CameraView}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "code128", "datamatrix", "aztec"],
        }}
        onBarcodeScanned={onBarcodeScanned}
      />
      <Button title="Sincronizar códigos con servidor" onPress={async () => {
        await syncAllToServer();
        fetchServerCodes(); // Actualiza la lista después de sincronizar
      }} />

      <Text style={{ fontWeight: "bold", marginTop: 10 }}>Códigos guardados en el servidor:</Text>
      <FlatList
        data={serverCodes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View>
            <Text>ID: {item.id}</Text>
            <Text>Data: {item.data}</Text>
            <Text>Type: {item.type}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: 'gray' }}>No hay códigos en el servidor.</Text>}
      />

      <Text style={{ fontWeight: "bold", marginTop: 10 }}>Códigos guardados localmente:</Text>
      <FlatList
        data={scannedCodes}
        keyExtractor={(item) => item.id}
        renderItem={ScannedItem}
        ListEmptyComponent={<Text style={{ color: 'gray' }}>No hay códigos locales.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  CameraView: {
    width: "100%",
    minHeight: 240,
  },
});
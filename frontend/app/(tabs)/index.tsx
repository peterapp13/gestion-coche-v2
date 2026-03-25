import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

interface Repostaje {
  repostaje_id: string;
  numero_factura: string;
  gasolinera: string;
  fecha: string;
  km_actuales: number;
  autonomia_antes: number;
  autonomia_despues: number;
  litros: number;
  precio_litro: number;
  total_euros: number;
  km_gastados?: number;
  consumo_l100km?: number;
}

export default function RepostajesScreen() {
  const router = useRouter();
  const [repostajes, setRepostajes] = useState<Repostaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    numero_factura: '',
    gasolinera: '',
    fecha: new Date().toISOString().split('T')[0],
    km_actuales: '',
    autonomia_antes: '',
    autonomia_despues: '',
    litros: '',
    precio_litro: '',
    total_euros: '',
  });

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    try {
      const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
      const authResponse = await fetch(`${backendUrl}/api/auth/me`, {
        credentials: 'include',
      });

      if (!authResponse.ok) {
        router.replace('/');
        return;
      }

      fetchRepostajes();
    } catch (error) {
      console.error('Auth check error:', error);
      router.replace('/');
    }
  };

  const fetchRepostajes = async () => {
    try {
      const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/repostajes`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setRepostajes(data);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRepostajes();
  };

  const handleSubmit = async () => {
    try {
      const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/repostajes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          km_actuales: parseFloat(formData.km_actuales),
          autonomia_antes: parseFloat(formData.autonomia_antes),
          autonomia_despues: parseFloat(formData.autonomia_despues),
          litros: parseFloat(formData.litros),
          precio_litro: parseFloat(formData.precio_litro),
          total_euros: parseFloat(formData.total_euros),
        }),
      });

      if (response.ok) {
        setModalVisible(false);
        resetForm();
        fetchRepostajes();
      }
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Eliminar repostaje',
      '¿Estás seguro de que quieres eliminar este registro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
              const response = await fetch(`${backendUrl}/api/repostajes/${id}`, {
                method: 'DELETE',
                credentials: 'include',
              });

              if (response.ok) {
                fetchRepostajes();
              }
            } catch (error) {
              console.error('Delete error:', error);
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      numero_factura: '',
      gasolinera: '',
      fecha: new Date().toISOString().split('T')[0],
      km_actuales: '',
      autonomia_antes: '',
      autonomia_despues: '',
      litros: '',
      precio_litro: '',
      total_euros: '',
    });
  };

  const renderItem = ({ item }: { item: Repostaje }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{item.gasolinera}</Text>
          <Text style={styles.cardSubtitle}>Factura: {item.numero_factura}</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDelete(item.repostaje_id)}
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.row}>
          <Text style={styles.label}>Fecha:</Text>
          <Text style={styles.value}>{item.fecha}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>KM Actuales:</Text>
          <Text style={styles.value}>{item.km_actuales.toLocaleString()} km</Text>
        </View>
        {item.km_gastados !== null && (
          <View style={styles.row}>
            <Text style={styles.label}>KM Gastados:</Text>
            <Text style={[styles.value, styles.highlight]}>{item.km_gastados?.toFixed(0)} km</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Litros:</Text>
          <Text style={styles.value}>{item.litros} L</Text>
        </View>
        {item.consumo_l100km !== null && (
          <View style={styles.row}>
            <Text style={styles.label}>Consumo:</Text>
            <Text style={[styles.value, styles.highlight]}>{item.consumo_l100km} L/100km</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Precio/L:</Text>
          <Text style={styles.value}>{item.precio_litro.toFixed(2)} €</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.labelBold}>Total:</Text>
          <Text style={styles.valueBold}>{item.total_euros.toFixed(2)} €</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={repostajes}
        renderItem={renderItem}
        keyExtractor={(item) => item.repostaje_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#4285F4"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="water-outline" size={64} color="#6B7280" />
            <Text style={styles.emptyText}>No hay repostajes registrados</Text>
            <Text style={styles.emptySubtext}>Toca el botón + para añadir uno</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Repostaje</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form}>
              <Text style={styles.inputLabel}>Nº Factura</Text>
              <TextInput
                style={styles.input}
                value={formData.numero_factura}
                onChangeText={(text) => setFormData({ ...formData, numero_factura: text })}
                placeholder="ABC123"
                placeholderTextColor="#6B7280"
              />

              <Text style={styles.inputLabel}>Gasolinera</Text>
              <TextInput
                style={styles.input}
                value={formData.gasolinera}
                onChangeText={(text) => setFormData({ ...formData, gasolinera: text })}
                placeholder="Repsol, Cepsa, etc."
                placeholderTextColor="#6B7280"
              />

              <Text style={styles.inputLabel}>Fecha</Text>
              <TextInput
                style={styles.input}
                value={formData.fecha}
                onChangeText={(text) => setFormData({ ...formData, fecha: text })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#6B7280"
              />

              <Text style={styles.inputLabel}>KM Actuales</Text>
              <TextInput
                style={styles.input}
                value={formData.km_actuales}
                onChangeText={(text) => setFormData({ ...formData, km_actuales: text })}
                placeholder="50000"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Autonomía Antes (km)</Text>
              <TextInput
                style={styles.input}
                value={formData.autonomia_antes}
                onChangeText={(text) => setFormData({ ...formData, autonomia_antes: text })}
                placeholder="50"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Autonomía Después (km)</Text>
              <TextInput
                style={styles.input}
                value={formData.autonomia_despues}
                onChangeText={(text) => setFormData({ ...formData, autonomia_despues: text })}
                placeholder="650"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Litros</Text>
              <TextInput
                style={styles.input}
                value={formData.litros}
                onChangeText={(text) => setFormData({ ...formData, litros: text })}
                placeholder="45.5"
                placeholderTextColor="#6B7280"
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Precio por Litro (€)</Text>
              <TextInput
                style={styles.input}
                value={formData.precio_litro}
                onChangeText={(text) => setFormData({ ...formData, precio_litro: text })}
                placeholder="1.45"
                placeholderTextColor="#6B7280"
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Total (€)</Text>
              <TextInput
                style={styles.input}
                value={formData.total_euros}
                onChangeText={(text) => setFormData({ ...formData, total_euros: text })}
                placeholder="65.97"
                placeholderTextColor="#6B7280"
                keyboardType="decimal-pad"
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>Guardar Repostaje</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  deleteButton: {
    padding: 4,
  },
  cardContent: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  value: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  labelBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  valueBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  highlight: {
    color: '#10B981',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#9CA3AF',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  form: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#4285F4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

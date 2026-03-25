#!/usr/bin/env python3
"""
Vehicle Management API Backend Testing
Tests all endpoints with authentication and data validation
"""

import requests
import json
import time
import subprocess
import sys
from datetime import datetime, timedelta

# Configuration
BACKEND_URL = "https://car-maintenance-78.preview.emergentagent.com/api"
TEST_USER_EMAIL = f"test.user.{int(time.time())}@example.com"
TEST_USER_NAME = "Test User"

class VehicleAPITester:
    def __init__(self):
        self.session_token = None
        self.user_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, message="", details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "details": details
        })
        
    def create_test_user_and_session(self):
        """Create test user and session in MongoDB using auth_testing.md approach"""
        print("\n=== Creating Test User & Session ===")
        
        try:
            # Generate unique IDs
            timestamp = int(time.time())
            user_id = f"test-user-{timestamp}"
            session_token = f"test_session_{timestamp}"
            
            # MongoDB command to create test user and session
            mongo_command = f'''
mongosh --eval "
use('vehicle_management');
var userId = '{user_id}';
var sessionToken = '{session_token}';
db.users.insertOne({{
  user_id: userId,
  email: '{TEST_USER_EMAIL}',
  name: '{TEST_USER_NAME}',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
}});
db.user_sessions.insertOne({{
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
'''
            
            result = subprocess.run(mongo_command, shell=True, capture_output=True, text=True)
            
            if result.returncode == 0:
                self.session_token = session_token
                self.user_id = user_id
                self.log_result("Create Test User", True, f"Created user {user_id} with session {session_token}")
                return True
            else:
                self.log_result("Create Test User", False, f"MongoDB command failed: {result.stderr}")
                return False
                
        except Exception as e:
            self.log_result("Create Test User", False, f"Exception: {str(e)}")
            return False
    
    def test_health_check(self):
        """Test GET /api/health endpoint"""
        print("\n=== Testing Health Check ===")
        
        try:
            response = requests.get(f"{BACKEND_URL}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy" and data.get("service") == "vehicle-management-api":
                    self.log_result("Health Check", True, "API is healthy")
                    return True
                else:
                    self.log_result("Health Check", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_result("Health Check", False, f"Status code: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Health Check", False, f"Exception: {str(e)}")
            return False
    
    def test_auth_me(self):
        """Test GET /api/auth/me with session token"""
        print("\n=== Testing Authentication ===")
        
        if not self.session_token:
            self.log_result("Auth Me", False, "No session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{BACKEND_URL}/auth/me", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("user_id") == self.user_id and data.get("email") == TEST_USER_EMAIL:
                    self.log_result("Auth Me", True, f"User authenticated: {data.get('name')}")
                    return True
                else:
                    self.log_result("Auth Me", False, f"User data mismatch: {data}")
                    return False
            else:
                self.log_result("Auth Me", False, f"Status code: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Auth Me", False, f"Exception: {str(e)}")
            return False
    
    def test_repostajes_module(self):
        """Test Repostajes (Fuel Records) CRUD operations"""
        print("\n=== Testing Repostajes Module ===")
        
        if not self.session_token:
            self.log_result("Repostajes Module", False, "No session token available")
            return False
        
        headers = {
            "Authorization": f"Bearer {self.session_token}",
            "Content-Type": "application/json"
        }
        
        # Test GET (empty list initially)
        try:
            response = requests.get(f"{BACKEND_URL}/repostajes", headers=headers, timeout=10)
            if response.status_code == 200:
                initial_records = response.json()
                self.log_result("Get Repostajes (Initial)", True, f"Retrieved {len(initial_records)} records")
            else:
                self.log_result("Get Repostajes (Initial)", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Get Repostajes (Initial)", False, f"Exception: {str(e)}")
            return False
        
        # Test POST - Create first record
        first_record_data = {
            "numero_factura": "FAC001",
            "gasolinera": "Repsol",
            "fecha": "2025-01-10",
            "km_actuales": 50000,
            "autonomia_antes": 200,
            "autonomia_despues": 650,
            "litros": 45.5,
            "precio_litro": 1.45,
            "total_euros": 65.98
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/repostajes", 
                                   headers=headers, 
                                   json=first_record_data, 
                                   timeout=10)
            
            if response.status_code == 200:
                first_record = response.json()
                first_repostaje_id = first_record.get("repostaje_id")
                
                # Verify auto-calculations for first record (should be None)
                if first_record.get("km_gastados") is None and first_record.get("consumo_l100km") is None:
                    self.log_result("Create First Repostaje", True, f"Created record {first_repostaje_id}")
                else:
                    self.log_result("Create First Repostaje", False, "Auto-calculations should be None for first record")
                    return False
            else:
                self.log_result("Create First Repostaje", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Create First Repostaje", False, f"Exception: {str(e)}")
            return False
        
        # Test POST - Create second record (should have auto-calculations)
        second_record_data = {
            "numero_factura": "FAC002",
            "gasolinera": "Cepsa",
            "fecha": "2025-01-15",
            "km_actuales": 50500,
            "autonomia_antes": 150,
            "autonomia_despues": 600,
            "litros": 42.0,
            "precio_litro": 1.42,
            "total_euros": 59.64
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/repostajes", 
                                   headers=headers, 
                                   json=second_record_data, 
                                   timeout=10)
            
            if response.status_code == 200:
                second_record = response.json()
                second_repostaje_id = second_record.get("repostaje_id")
                
                # Verify auto-calculations
                km_gastados = second_record.get("km_gastados")
                consumo_l100km = second_record.get("consumo_l100km")
                
                expected_km_gastados = 50500 - 50000  # 500 km
                expected_consumo = round((45.5 / 500) * 100, 2)  # Using first record's litros
                
                if km_gastados == expected_km_gastados:
                    self.log_result("Create Second Repostaje - KM Calculation", True, f"KM gastados: {km_gastados}")
                else:
                    self.log_result("Create Second Repostaje - KM Calculation", False, f"Expected {expected_km_gastados}, got {km_gastados}")
                
                if consumo_l100km and consumo_l100km > 0:
                    self.log_result("Create Second Repostaje - Consumption", True, f"Consumo: {consumo_l100km} L/100km")
                else:
                    self.log_result("Create Second Repostaje - Consumption", False, f"Invalid consumption: {consumo_l100km}")
                    
            else:
                self.log_result("Create Second Repostaje", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Create Second Repostaje", False, f"Exception: {str(e)}")
            return False
        
        # Test GET (should now have 2 records)
        try:
            response = requests.get(f"{BACKEND_URL}/repostajes", headers=headers, timeout=10)
            if response.status_code == 200:
                records = response.json()
                if len(records) >= 2:
                    self.log_result("Get Repostajes (After Creation)", True, f"Retrieved {len(records)} records")
                else:
                    self.log_result("Get Repostajes (After Creation)", False, f"Expected at least 2 records, got {len(records)}")
            else:
                self.log_result("Get Repostajes (After Creation)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Get Repostajes (After Creation)", False, f"Exception: {str(e)}")
        
        # Test DELETE
        if first_repostaje_id:
            try:
                response = requests.delete(f"{BACKEND_URL}/repostajes/{first_repostaje_id}", 
                                         headers=headers, timeout=10)
                
                if response.status_code == 200:
                    self.log_result("Delete Repostaje", True, f"Deleted record {first_repostaje_id}")
                else:
                    self.log_result("Delete Repostaje", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_result("Delete Repostaje", False, f"Exception: {str(e)}")
        
        return True
    
    def test_almacen_module(self):
        """Test Almacén (Parts Storage) CRUD operations"""
        print("\n=== Testing Almacén Module ===")
        
        if not self.session_token:
            self.log_result("Almacén Module", False, "No session token available")
            return False
        
        headers = {
            "Authorization": f"Bearer {self.session_token}",
            "Content-Type": "application/json"
        }
        
        # Test GET (empty list initially)
        try:
            response = requests.get(f"{BACKEND_URL}/almacen", headers=headers, timeout=10)
            if response.status_code == 200:
                initial_records = response.json()
                self.log_result("Get Almacén (Initial)", True, f"Retrieved {len(initial_records)} records")
            else:
                self.log_result("Get Almacén (Initial)", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Get Almacén (Initial)", False, f"Exception: {str(e)}")
            return False
        
        # Test POST - Create part
        part_data = {
            "fecha_compra": "2025-01-12",
            "recambio": "Filtro de aceite",
            "marca": "Mann",
            "coste_euros": 15.50,
            "estado": "Pendiente"
        }
        
        almacen_id = None
        try:
            response = requests.post(f"{BACKEND_URL}/almacen", 
                                   headers=headers, 
                                   json=part_data, 
                                   timeout=10)
            
            if response.status_code == 200:
                part_record = response.json()
                almacen_id = part_record.get("almacen_id")
                
                # Verify default status
                if part_record.get("estado") == "Pendiente":
                    self.log_result("Create Almacén Part", True, f"Created part {almacen_id} with status 'Pendiente'")
                else:
                    self.log_result("Create Almacén Part", False, f"Expected status 'Pendiente', got {part_record.get('estado')}")
                    return False
            else:
                self.log_result("Create Almacén Part", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Create Almacén Part", False, f"Exception: {str(e)}")
            return False
        
        # Test GET (should now have 1 record)
        try:
            response = requests.get(f"{BACKEND_URL}/almacen", headers=headers, timeout=10)
            if response.status_code == 200:
                records = response.json()
                if len(records) >= 1:
                    self.log_result("Get Almacén (After Creation)", True, f"Retrieved {len(records)} records")
                else:
                    self.log_result("Get Almacén (After Creation)", False, f"Expected at least 1 record, got {len(records)}")
            else:
                self.log_result("Get Almacén (After Creation)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Get Almacén (After Creation)", False, f"Exception: {str(e)}")
        
        # Store almacen_id for taller testing
        self.test_almacen_id = almacen_id
        
        return True
    
    def test_taller_module(self):
        """Test Taller (Workshop) CRUD operations"""
        print("\n=== Testing Taller Module ===")
        
        if not self.session_token:
            self.log_result("Taller Module", False, "No session token available")
            return False
        
        headers = {
            "Authorization": f"Bearer {self.session_token}",
            "Content-Type": "application/json"
        }
        
        # Test GET (empty list initially)
        try:
            response = requests.get(f"{BACKEND_URL}/taller", headers=headers, timeout=10)
            if response.status_code == 200:
                initial_records = response.json()
                self.log_result("Get Taller (Initial)", True, f"Retrieved {len(initial_records)} records")
            else:
                self.log_result("Get Taller (Initial)", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Get Taller (Initial)", False, f"Exception: {str(e)}")
            return False
        
        # Test POST - Create workshop record WITH almacen_id (should update almacen status)
        if hasattr(self, 'test_almacen_id') and self.test_almacen_id:
            workshop_data_with_almacen = {
                "fecha_montaje": "2025-01-13",
                "km_montaje": 50250,
                "recambio_instalado": "Filtro de aceite",
                "almacen_id": self.test_almacen_id,
                "notas": "Instalación rutinaria"
            }
            
            taller_id_with_almacen = None
            try:
                response = requests.post(f"{BACKEND_URL}/taller", 
                                       headers=headers, 
                                       json=workshop_data_with_almacen, 
                                       timeout=10)
                
                if response.status_code == 200:
                    workshop_record = response.json()
                    taller_id_with_almacen = workshop_record.get("taller_id")
                    self.log_result("Create Taller with Almacén ID", True, f"Created workshop record {taller_id_with_almacen}")
                    
                    # Verify almacen status was updated to "Instalado"
                    almacen_response = requests.get(f"{BACKEND_URL}/almacen", headers=headers, timeout=10)
                    if almacen_response.status_code == 200:
                        almacen_records = almacen_response.json()
                        updated_part = next((part for part in almacen_records if part.get("almacen_id") == self.test_almacen_id), None)
                        
                        if updated_part and updated_part.get("estado") == "Instalado":
                            self.log_result("Almacén Status Auto-Update", True, "Part status updated to 'Instalado'")
                        else:
                            self.log_result("Almacén Status Auto-Update", False, f"Expected 'Instalado', got {updated_part.get('estado') if updated_part else 'Part not found'}")
                    else:
                        self.log_result("Almacén Status Auto-Update", False, "Could not verify almacen status update")
                        
                else:
                    self.log_result("Create Taller with Almacén ID", False, f"Status: {response.status_code}, Response: {response.text}")
                    return False
            except Exception as e:
                self.log_result("Create Taller with Almacén ID", False, f"Exception: {str(e)}")
                return False
        
        # Test POST - Create workshop record WITHOUT almacen_id (free text)
        workshop_data_free_text = {
            "fecha_montaje": "2025-01-14",
            "km_montaje": 50300,
            "recambio_instalado": "Cambio de aceite motor",
            "notas": "Aceite 5W30 sintético"
        }
        
        taller_id_free_text = None
        try:
            response = requests.post(f"{BACKEND_URL}/taller", 
                                   headers=headers, 
                                   json=workshop_data_free_text, 
                                   timeout=10)
            
            if response.status_code == 200:
                workshop_record = response.json()
                taller_id_free_text = workshop_record.get("taller_id")
                self.log_result("Create Taller (Free Text)", True, f"Created workshop record {taller_id_free_text}")
            else:
                self.log_result("Create Taller (Free Text)", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Create Taller (Free Text)", False, f"Exception: {str(e)}")
            return False
        
        # Test GET (should now have records)
        try:
            response = requests.get(f"{BACKEND_URL}/taller", headers=headers, timeout=10)
            if response.status_code == 200:
                records = response.json()
                if len(records) >= 1:
                    self.log_result("Get Taller (After Creation)", True, f"Retrieved {len(records)} records")
                else:
                    self.log_result("Get Taller (After Creation)", False, f"Expected at least 1 record, got {len(records)}")
            else:
                self.log_result("Get Taller (After Creation)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Get Taller (After Creation)", False, f"Exception: {str(e)}")
        
        # Test DELETE
        if taller_id_free_text:
            try:
                response = requests.delete(f"{BACKEND_URL}/taller/{taller_id_free_text}", 
                                         headers=headers, timeout=10)
                
                if response.status_code == 200:
                    self.log_result("Delete Taller", True, f"Deleted workshop record {taller_id_free_text}")
                else:
                    self.log_result("Delete Taller", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_result("Delete Taller", False, f"Exception: {str(e)}")
        
        return True
    
    def test_export_module(self):
        """Test Export endpoint"""
        print("\n=== Testing Export Module ===")
        
        if not self.session_token:
            self.log_result("Export Module", False, "No session token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        try:
            response = requests.get(f"{BACKEND_URL}/export", headers=headers, timeout=10)
            
            if response.status_code == 200:
                export_data = response.json()
                
                # Verify response contains all three modules
                required_modules = ["repostajes", "almacen", "taller"]
                missing_modules = []
                
                for module in required_modules:
                    if module not in export_data:
                        missing_modules.append(module)
                
                if not missing_modules:
                    repostajes_count = len(export_data.get("repostajes", []))
                    almacen_count = len(export_data.get("almacen", []))
                    taller_count = len(export_data.get("taller", []))
                    
                    self.log_result("Export Data", True, 
                                  f"Export contains all modules - Repostajes: {repostajes_count}, Almacén: {almacen_count}, Taller: {taller_count}")
                    return True
                else:
                    self.log_result("Export Data", False, f"Missing modules: {missing_modules}")
                    return False
            else:
                self.log_result("Export Data", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Export Data", False, f"Exception: {str(e)}")
            return False
    
    def cleanup_test_data(self):
        """Clean up test data from MongoDB"""
        print("\n=== Cleaning Up Test Data ===")
        
        try:
            cleanup_command = f'''
mongosh --eval "
use('vehicle_management');
db.users.deleteMany({{email: /test\\.user\\./}});
db.user_sessions.deleteMany({{session_token: /test_session/}});
db.repostajes.deleteMany({{user_id: '{self.user_id}'}});
db.almacen.deleteMany({{user_id: '{self.user_id}'}});
db.taller.deleteMany({{user_id: '{self.user_id}'}});
print('Cleanup completed');
"
'''
            
            result = subprocess.run(cleanup_command, shell=True, capture_output=True, text=True)
            
            if result.returncode == 0:
                self.log_result("Cleanup Test Data", True, "Test data cleaned up successfully")
            else:
                self.log_result("Cleanup Test Data", False, f"Cleanup failed: {result.stderr}")
                
        except Exception as e:
            self.log_result("Cleanup Test Data", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Vehicle Management API Backend Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Step 1: Health Check (no auth required)
        self.test_health_check()
        
        # Step 2: Create test user and session
        if not self.create_test_user_and_session():
            print("❌ Cannot proceed without test user. Exiting.")
            return False
        
        # Step 3: Test authentication
        if not self.test_auth_me():
            print("❌ Authentication failed. Exiting.")
            return False
        
        # Step 4: Test all modules
        self.test_repostajes_module()
        self.test_almacen_module()
        self.test_taller_module()
        self.test_export_module()
        
        # Step 5: Cleanup
        self.cleanup_test_data()
        
        # Summary
        self.print_summary()
        
        return True
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        failed = total - passed
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        if failed > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['message']}")
        
        print("\n" + "=" * 60)

def main():
    """Main function"""
    tester = VehicleAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("🎉 All tests completed!")
    else:
        print("⚠️  Some tests failed. Check the summary above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
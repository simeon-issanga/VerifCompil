import subprocess

def test_clang_works():
    test_code = "int main() { return 0; }"
    with open("test.c", "w") as f:
        f.write(test_code)
    
    result = subprocess.run(["clang", "test.c", "-emit-llvm", "-S", "-o", "test.ll"])
    assert result.returncode == 0
    print("Test Clang : OK")
    

if __name__ == "__main__":
    test_clang_works()
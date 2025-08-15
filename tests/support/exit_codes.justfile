# Recipe that succeeds
success:
    echo "Success!"

# Recipe that fails
failure:
    #!/usr/bin/env bash
    echo "This will fail"
    exit 1

<script>
    let searchQuery = "";
    async function handleSearch() {
        const query = encodeURIComponent(searchQuery);
        const response = await fetch(`http://localhost:8000/search/${query}`);


        if (!response.ok) {
            console.error("Failed to fetch data", response.status);
            return;
        }

        const results = await response.json();
        console.log(results);
    }
</script>

<main>
    <div class="search">
        <input
            type="text"
            placeholder="Search..."
            bind:value={searchQuery}
            onkeydown={(event) => {
                if (event.key === "Enter") {
                    handleSearch();
                }
            }}
        />
        <button onclick={handleSearch}>Search</button>
    </div>
</main>

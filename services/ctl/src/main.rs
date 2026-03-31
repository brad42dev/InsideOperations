use clap::{Parser, Subcommand};

mod commands;

/// Inside/Operations administration CLI
#[derive(Parser)]
#[command(
    name = "io-ctl",
    about = "Inside/Operations administration CLI",
    version
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Generate the master encryption key and seal it via systemd-creds.
    ///
    /// Generates 32 cryptographically secure random bytes, encrypts them
    /// with systemd-creds (binding to TPM2 if available, otherwise to the
    /// host credential secret), and writes the encrypted blob to
    /// /etc/io/creds/master-key.enc.
    ///
    /// The plaintext key is securely erased from disk after encryption.
    /// Run this command once during initial installation. Back up the
    /// encrypted blob immediately afterward.
    GenerateMasterKey,
}

fn main() {
    let cli = Cli::parse();

    let result = match cli.command {
        Commands::GenerateMasterKey => commands::generate_master_key::run(),
    };

    if let Err(err) = result {
        eprintln!("ERROR: {err:#}");
        std::process::exit(1);
    }
}

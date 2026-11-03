import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

android {
    compileSdk = 37
    namespace = "app.timora.android"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "app.timora.android"
        minSdk = 24
        targetSdk = 37
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    val signingValues = listOf("TIMORA_ANDROID_KEYSTORE", "TIMORA_ANDROID_KEY_ALIAS", "TIMORA_ANDROID_STORE_PASSWORD", "TIMORA_ANDROID_KEY_PASSWORD")
        .associateWith { System.getenv(it)?.takeIf { value -> value.isNotBlank() } }
    val releaseSigningReady = signingValues.values.all { it != null }
    if (releaseSigningReady) {
        signingConfigs {
            create("release") {
                storeFile = file(signingValues.getValue("TIMORA_ANDROID_KEYSTORE")!!)
                keyAlias = signingValues.getValue("TIMORA_ANDROID_KEY_ALIAS")
                storePassword = signingValues.getValue("TIMORA_ANDROID_STORE_PASSWORD")
                keyPassword = signingValues.getValue("TIMORA_ANDROID_KEY_PASSWORD")
            }
        }
    }
    gradle.taskGraph.whenReady {
        if (allTasks.any { it.project == project && it.name.contains("Release", ignoreCase = true) } && !releaseSigningReady) {
            throw GradleException("Release signing is not configured. Provide the four TIMORA_ANDROID signing variables; debug signing is never used for release.")
        }
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {
                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            if (releaseSigningReady) signingConfig = signingConfigs.getByName("release")
            optimization {
               enable = true
            }
            proguardFiles(
                *fileTree(".") {
                  include("**/*.pro")
                  exclude("build/**")
                }.files.toTypedArray()
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    buildFeatures {
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_1_8
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = file("tauri.build.gradle.kts"))
